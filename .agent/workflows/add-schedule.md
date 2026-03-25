---
description: Add a scheduled cron task with the schedule engine
---

Add a scheduled task using the schedule engine (`@shared/api`).

## How Scheduling Works

The schedule engine wraps `node-cron` and is accessible via `container.resolve('schedule')`. Tasks are registered during module `boot()` and run automatically based on cron expressions.

## Step-by-Step

### 1. Register Scheduled Task in Module Init

```javascript
// src/apps/{module-name}/api/index.js — inside boot()
export async function boot(container) {
  
  const schedule = container.resolve('schedule');

  // Lightweight task — runs directly
  schedule.register('{module-name}:daily-cleanup', '0 0 * * *', async () => {
    const { models } = container.resolve('db');
    await models.TempFile.destroy({
      where: { createdAt: { [Op.lt]: subDays(new Date(), 7) } },
    });
    console.log('[Schedule] Daily cleanup complete');
  });

  // Heavy task — dispatch to worker pool
  schedule.register('{module-name}:weekly-report', '0 9 * * 1', async () => {
    const workerPool = container.resolve('{module-name}:workerPool');
    await workerPool.sendRequest('weekly-report', 'GENERATE_REPORT', {
      week: getCurrentWeek(),
    });
  });
}
```

### 2. Common Cron Expressions

| Expression | Schedule |
|---|---|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * 1` | Monday at 9 AM |
| `0 0 1 * *` | First of each month |

### 3. Write Tests

// turbo
```bash
npm run test -- schedule
```

```javascript
describe('{Module} Scheduled Tasks', () => {
  it('should clean up expired temp files', async () => {
    // Create expired records, run handler, verify deletion
  });
});
```

### 4. Run Full Suite

// turbo
```bash
npm test
```

## Guidelines

- **Keep handlers lightweight.** For heavy processing, dispatch to a worker pool.
- **Use descriptive task names.** Format: `{module}:{action}` (e.g., `billing:invoice-reminders`).
- **Log execution.** Always log start/completion for debugging cron issues.
- **Handle errors.** Wrap handler body in try-catch — uncaught errors in cron handlers are silent.
