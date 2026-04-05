---
description: Add a background worker with direct function calls
---

Add a background worker for processing tasks.

## When to Use Workers

Use workers for:

- Data processing (search indexing, checksum computation)
- Database-heavy operations (bulk inserts, reporting)
- File operations (batch uploads, ZIP creation)
- Tasks that benefit from clean separation of concerns

> **Note:** Tier 1 workers run same-process via direct function calls. For **CPU-bound** workers (Tier 2), use the `worker` engine which delegates to a piscina thread pool. See the **Thread Pool Workers** section below.

## Structure

```
@apps/{module}/api/workers/
├── index.js                    # Utility barrel (exports convenience functions)
├── {task-name}.worker.js       # Worker function
└── {task-name}.worker.test.js  # Worker tests
```

## 1. Create Worker Function

```javascript
// @apps/posts/api/workers/generate-report.worker.js

/**
 * Generate posts report
 * @param {Object} data - Job payload
 * @param {Date} data.startDate - Report start date
 * @param {Date} data.endDate - Report end date
 * @param {Object} data.models - Sequelize models
 * @returns {Object} Report data
 */
export default async function generateReport(data) {
  const { startDate, endDate, models } = data;
  const { Post } = models;
  const { sequelize } = Post;
  const { Op } = sequelize.Sequelize;

  const posts = await Post.findAll({
    where: {
      createdAt: {
        [Op.between]: [startDate, endDate],
      },
    },
  });

  return {
    totalPosts: posts.length,
    publishedPosts: posts.filter(p => p.published).length,
    authors: [...new Set(posts.map(p => p.authorId))].length,
    generatedAt: new Date(),
  };
}
```

## 2. Create Utility Barrel

```javascript
// @apps/posts/api/workers/index.js
import generateReportWorker from './generate-report.worker';

/**
 * Generate a posts report.
 * @param {Object} models - Sequelize models
 * @param {Date} startDate - Report start date
 * @param {Date} endDate - Report end date
 * @returns {Promise<Object>} Report result
 */
export async function generateReport(models, startDate, endDate) {
  return await generateReportWorker({ models, startDate, endDate });
}
```

## 3. Call Worker Functions

### From API Endpoint

```javascript
// @apps/posts/api/controllers/report.controller.js
import { generateReport } from '../workers';

export async function get(req, res) {
  const http = req.container.resolve('http');

  try {
    const { startDate, endDate } = req.query;
    const models = req.container.resolve('models');
    const result = await generateReport(models, startDate, endDate);
    return http.sendSuccess(res, { data: result });
  } catch (error) {
    return http.sendServerError(res, 'Failed to generate report');
  }
}
```

### From Boot Lifecycle

```javascript
// @apps/posts/api/index.js
export default {
  // ...context loaders...

  async boot({ container }) {
    const search = container.resolve('search');

    if (search) {
      const { indexAllPosts, registerSearchHooks } = require('./workers');
      registerSearchHooks(container, search);

      const count = await search.withNamespace('posts').count();
      if (count === 0) {
        indexAllPosts(search, container.resolve('models'))
          .then(r => console.info(`[Posts] Indexed ${r.count} post(s)`))
          .catch(e => console.error('[Posts] Indexing failed:', e.message));
      }
    }
  },
};
```

### From Hook Listener

```javascript
// @apps/posts/api/hooks.js
export function registerPostHooks(container) {
  const hook = container.resolve('hook');
  const { logPostActivity } = require('./workers');

  if (!hook) return;

  hook('posts').on('created', async ({ post }) => {
    try {
      await logPostActivity(container, {
        event: 'post.created',
        entity_id: post.id,
      });
    } catch (err) {
      console.warn(`[Posts] Hook error: ${err.message}`);
    }
  });
}
```

## 4. Testing Workers

```javascript
// @apps/posts/api/workers/generate-report.worker.test.js
import generateReport from './generate-report.worker';

describe('[worker] generate-report', () => {
  it('should generate report successfully', async () => {
    const mockModels = {
      Post: {
        findAll: jest.fn().mockResolvedValue([
          { published: true, authorId: 'a1' },
          { published: false, authorId: 'a2' },
        ]),
        sequelize: { Sequelize: { Op: {} } },
      },
    };

    const result = await generateReport({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      models: mockModels,
    });

    expect(result).toHaveProperty('totalPosts', 2);
    expect(result).toHaveProperty('publishedPosts', 1);
    expect(result).toHaveProperty('authors', 2);
    expect(result).toHaveProperty('generatedAt');
  });
});
```

## Best Practices

1. **Worker functions are pure async functions** — import and call directly, no pool abstraction
2. **Pass dependencies explicitly** — models, search, container as function args (not DI resolution inside worker)
3. **Utility barrel pattern** — `workers/index.js` wraps raw worker functions with clean API
4. **Handle errors at call site** — use `try/catch` where you call the worker function
5. **Test worker logic directly** — import the exported function and call it with mock data
6. **Keep worker files focused** — one concern per `*.worker.js` file
7. **Use with Schedule Engine** — for recurring background jobs via queue
8. **Use thread pool for CPU-bound only** — see Thread Pool Workers below

## Thread Pool Workers (CPU-Bound)

For **pure, CPU-bound** workers with serializable I/O (no DI, no models, no container), use the `worker` engine thread pool to avoid blocking the event loop.

### Mark Worker as Threadable

```javascript
// @apps/analytics/api/workers/compute.worker.js
/** Marks this worker as eligible for thread pool execution. */
export const THREADED = true;

export function heavyCompute(data) {
  // CPU-intensive work — runs in isolated worker_thread
  const { input } = data;
  return { result: expensiveCalculation(input) };
}
```

### Call via Worker Engine

```javascript
// @apps/analytics/api/workers/index.js
export async function computeAnalytics(container, input) {
  const worker = container.resolve('worker');
  return await worker.run('compute', 'heavyCompute', { input });
}
```

### Requirements

- Export `THREADED = true` in the worker file
- All inputs and outputs must be JSON-serializable
- No imports of DI-dependent modules (`container`, `models`, `search`, `db`)
- Pure functions only — no side effects on shared state

### Choosing Between Direct and Thread Pool

| Worker needs... | Use |
|-----------------|-----|
| `models`, `search`, `db`, `container` | Direct function call (Tier 1) |
| Only serializable data, CPU-heavy | Thread pool via `worker.run()` (Tier 2) |

## Common Patterns

### Fire and Forget

```javascript
// Don't await, but handle rejection
generateReport(models, startDate, endDate).catch(console.error);
```

### Batch Processing

```javascript
// Process multiple items
const items = [1, 2, 3, 4, 5];
const results = await Promise.all(
  items.map(item => processItem({ item, models })),
);
```

## Queue-Based Workers (Stateful)

When your worker needs `app` access with lifecycle awareness (e.g., extension activation/deactivation), use the **Queue Engine** for orchestration.

### When to Use Which Pattern

| Need | Pattern |
|------|---------|
| Database/FS operations | Direct worker function call |
| Search indexing hooks | Worker barrel with `registerSearchHooks()` |
| Needs lifecycle events (activate, deactivate) | Queue-based handler |
| Complex multi-step workflow | Queue handler calling worker functions |

### Queue-Based Handler Example

```javascript
// @apps/posts/api/services/post.workers.js
async function handlePublishJob(app, job) {
  const container = app.get('container');
  const { postId, actorId } = job.data;
  const { Post } = container.resolve('models');
  const hook = container.resolve('hook');

  const post = await Post.findByPk(postId);
  await post.update({ status: 'published' });

  if (hook) {
    hook('posts').emit('published', { post_id: postId, actor_id: actorId });
  }

  return { success: true };
}

export function registerPostWorkers(container) {
  const queue = container.resolve('queue');
  const channel = queue('posts');
  channel.on('publish', job => handlePublishJob(app, job));
}
```

See `src/apps/extensions/api/` for the canonical reference implementation.

---

## See Also

- `/add-module` — Full-stack module where workers are registered in `boot()`
- `/add-test` — Jest patterns for testing worker handler functions
- `/debug` — Part 10 covers extension lifecycle and SQLITE_BUSY with workers
- `/modify` — Modify existing workers with test verification
