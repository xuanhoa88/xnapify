---
description: Add worker
---

Add a background worker for heavy processing tasks.

## When to Use Workers

Use workers for:

- Heavy data processing
- Long-running operations
- Tasks that shouldn't block the main process
- Scheduled background jobs

## Structure

```
@apps/{module}/workers/
├── index.js                    # Worker pool
├── {task-name}.worker.js       # Worker handler
└── {task-name}.worker.test.js  # Worker tests
```

## 1. Create Worker Handler

```javascript
// @apps/posts/workers/generate-report.worker.js

/**
 * Generate posts report
 * @param {Object} payload - Job payload
 * @param {Date} payload.startDate - Report start date
 * @param {Date} payload.endDate - Report end date
 * @returns {Object} Report data
 */
async function generateReportLogic(payload) {
  const { startDate, endDate } = payload;

  // Heavy processing here
  const { connection } = require('@shared/api/db');
  const { Post } = connection.models;
  const { sequelize } = Post;
  const { Op } = sequelize.Sequelize;
  const posts = await Post.findAll({
    where: {
      createdAt: {
        [Op.between]: [startDate, endDate],
      },
    },
  });

  // Process data
  const report = {
    totalPosts: posts.length,
    publishedPosts: posts.filter(p => p.published).length,
    authors: [...new Set(posts.map(p => p.authorId))].length,
    generatedAt: new Date(),
  };

  return report;
}

// Export as a named function matching the message type
export { generateReportLogic as GENERATE_REPORT };
```

## 2. Create Worker Pool

```javascript
// @apps/posts/workers/index.js
import { createWorkerPool } from '@shared/api/worker';

const workersContext = require.context('.', false, /\.worker\.js$/);

const workerPool = createWorkerPool('Posts', workersContext, {
  maxWorkers: 2, // Controls concurrency
});

export default workerPool;
```

## 3. Dispatch Jobs to Workers

### From API Endpoint

```javascript
// @apps/posts/controllers/report.controller.js
import workerPool from '../workers';

export async function generateReport(req, res) {
  const http = req.app.get('http');

  try {
    const { startDate, endDate } = req.body;

    // Dispatch to worker (non-blocking) using throwOnError for standard error handling
    const result = await workerPool.sendRequest(
      'generate-report',
      'GENERATE_REPORT',
      { startDate, endDate },
      { throwOnError: true }
    );

    return http.sendSuccess(res, { data: result });
  } catch (error) {
    return http.sendServerError(res, 'Failed to generate report');
  }
}
```

### From Scheduled Task

```javascript
// @apps/posts/index.js
import schedule from '@shared/api/schedule';
import workerPool from './workers';

export default async function postsModule(deps, app) {
  // ... other module setup

  // Schedule daily report generation
  schedule.register('daily-posts-report', '0 0 * * *', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Dispatch to worker pool using native error handling
    await workerPool.sendRequest('daily-report', 'GENERATE_REPORT', {
      startDate: yesterday,
      endDate: today,
    }, { throwOnError: true });

    console.info('✅ Daily report generation dispatched');
  });

  console.info('✅ Posts module loaded');
  return router;
}
```

## 4. Worker with Error Handling

```javascript
// @apps/posts/workers/process-images.worker.js

async function processImagesLogic(payload) {
  const { postId, images } = payload;

  const processedImages = [];

  for (const image of images) {
    // Simulate heavy image processing
    const processed = await processImage(image);
    processedImages.push(processed);
  }

  return {
    success: true,
    postId,
    processedImages,
  };
  // Note: No need for a global try/catch here!
  // The Worker Engine handles uncaught errors gracefully and returns them to the caller,
  // or throws them directly if `throwOnError: true` is set in the request.
}

async function processImage(image) {
  // Heavy processing logic
  return { ...image, processed: true };
}

export { processImagesLogic as PROCESS_IMAGES };
```

## 5. Testing Workers

```javascript
// @apps/posts/workers/generate-report.worker.test.js
import { GENERATE_REPORT } from './generate-report.worker';

describe('[worker] generate-report', () => {
  it('should generate report successfully', async () => {
    const payload = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };

    // Workers export their core handler directly
    const result = await GENERATE_REPORT(payload);

    expect(result).toHaveProperty('totalPosts');
    expect(result).toHaveProperty('publishedPosts');
    expect(result).toHaveProperty('authors');
    expect(result).toHaveProperty('generatedAt');
  });

  it('should handle empty date range', async () => {
    const payload = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-01'),
    };

    const result = await GENERATE_REPORT(payload);

    expect(result.totalPosts).toBe(0);
  });
});
```

## Worker Pool Configuration

```javascript
// Advanced worker pool configuration
const workerPool = createWorkerPool('Posts', workersContext, {
  maxWorkers: 4, // Maximum concurrent workers
  timeout: 30000, // Worker timeout (30s)
  retries: 2, // Retry failed jobs
  onError: (error, job) => {
    console.error(`Worker error for job ${job.name}:`, error);
  },
});
```

## Monitoring Workers

```javascript
// Check worker pool status
const status = workerPool.getStatus();
console.log('Active workers:', status.activeWorkers);
console.log('Queued jobs:', status.queuedJobs);

// Wait for all workers to complete
await workerPool.drain();
```

## Best Practices

1. **Use workers for heavy tasks** - Don't block the main process
2. **Set appropriate maxWorkers** - Balance concurrency vs resources
3. **Handle errors natively** - Use `{ throwOnError: true }` and `try/catch` at the dispatch site
4. **Test worker logic** - Workers are just async functions
5. **Monitor worker status** - Track active workers and queue
6. **Use with Schedule Engine** - For recurring background jobs
7. **Keep payloads serializable** - Workers use IPC, no functions/classes
8. **Set timeouts** - Prevent workers from hanging indefinitely

## Common Patterns

### Fire and Forget

```javascript
// Don't wait for result, but handle possible rejection internally if not throwing
workerPool.sendRequest('task', 'TASK_TYPE', payload).catch(console.error);
```

### Wait for Result

```javascript
// Wait for worker to complete securely with proper try/catch
try {
  const result = await workerPool.sendRequest('task', 'TASK_TYPE', payload, { throwOnError: true });
  console.log('Result:', result);
} catch (error) {
  console.error('Worker failed natively:', error);
}
```

### Batch Processing

```javascript
// Process multiple items securely
const items = [1, 2, 3, 4, 5];
const promises = items.map(item =>
  workerPool.sendRequest(`process-${item}`, 'PROCESS_ITEM', { item }, { throwOnError: true })
);

const results = await Promise.all(promises);
```
