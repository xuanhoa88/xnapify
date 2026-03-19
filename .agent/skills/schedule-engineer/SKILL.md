---
name: schedule-engineer
description: Register and manage cron-based scheduled tasks with the Schedule Engine for recurring background work.
---

# Schedule Engineer Skill

When creating or modifying scheduled tasks, enforce these patterns.

## Registration Pattern

Scheduled tasks are registered during module `init()` via `container.resolve('schedule')`.

```javascript
export async function init(container) {
  
  const schedule = container.resolve('schedule');

  schedule.register('module:task-name', '0 0 * * *', async () => {
    // Task logic
  });
}
```

## Rules

### 1. Naming
- Format: `{module}:{action}` — e.g., `billing:send-reminders`, `files:cleanup-temp`
- Must be globally unique across all modules

### 2. Lightweight Handlers
- Cron handlers run on the main thread — keep them fast
- For heavy work, dispatch to a worker pool:

```javascript
schedule.register('reports:weekly', '0 9 * * 1', async () => {
  const pool = container.resolve('reports:workerPool');
  await pool.sendRequest('weekly', 'GENERATE_REPORT', { week: getCurrentWeek() });
});
```

### 3. Error Handling
- Always wrap handler body in try-catch — uncaught errors in cron are silent
- Log start and completion for debugging timing issues

```javascript
schedule.register('cleanup:expired', '*/30 * * * *', async () => {
  try {
    console.log('[Schedule] cleanup:expired started');
    const count = await cleanupExpired(container);
    console.log(`[Schedule] cleanup:expired done, removed ${count}`);
  } catch (error) {
    console.error('[Schedule] cleanup:expired failed:', error.message);
  }
});
```

### 4. Common Cron Expressions

| Expression | Schedule |
|---|---|
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * 1` | Monday at 9 AM |
| `0 0 1 * *` | First of each month |

### 5. Testing
- Extract the handler logic into a separate testable function
- Test the function independently, not the cron registration
