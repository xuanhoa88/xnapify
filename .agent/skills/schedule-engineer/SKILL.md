---
name: schedule-engineer
description: Register and manage cron-based scheduled tasks with the Schedule Engine for recurring background work.
---

# Schedule Engineer Skill

This skill equips you to register and manage recurring cron tasks for the `rapid-rsk` application using the Schedule Engine (`@shared/api/engines/schedule`).

## Core Concepts

The Schedule Engine wraps `node-cron` behind a `ScheduleManager` class. It provides:
- **Dynamic Registration**: Register/unregister tasks at runtime with unique names.
- **Auto-start**: Tasks start automatically upon registration (configurable).
- **Graceful Shutdown**: All tasks stop on process termination via `cleanup()`.
- **Statistics**: Inspect registered tasks, their status, and execution metadata.

A default singleton instance is exported from `@shared/api/engines/schedule` and bound to the DI container as `app.get('schedule')`.

## Procedure: Registering a Scheduled Task

1. **Registration Context:** Tasks are registered inside a module's `init(app)` lifecycle hook.
2. **Access the Engine:** `const schedule = app.get('schedule');`
3. **Register the Task:**
   ```javascript
   schedule.register('module-name:task-action', '0 0 * * *', async () => {
     // Task logic here
   });
   ```
4. **Parameters:**
   - `name` (string) — Unique identifier. Convention: `{module}:{action}` (e.g., `billing:invoice-reminders`).
   - `cronExpression` (string) — Standard cron expression (5 or 6 fields).
   - `handler` (async function) — The work to execute on each tick.
   - `options` (object, optional):
     - `scheduled` (boolean, default `true`) — Whether to auto-start.
     - `timezone` (string, default `'UTC'`) — IANA timezone for execution.

## Procedure: Managing Tasks at Runtime

```javascript
const schedule = app.get('schedule');

// Unregister a specific task
schedule.unregister('module-name:task-action');

// Check if a task is currently running
schedule.isTaskRunning('module-name:task-action');

// Get all registered task names
const names = schedule.getAllTasks(); // ['task1', 'task2']

// Get detailed statistics
const stats = schedule.getStats();
// { total: 2, running: 1, stopped: 1, tasks: { ... } }

// Bulk start / stop all tasks
schedule.start();
schedule.stop();

// Full teardown (called automatically on process exit)
schedule.cleanup();
```

## Procedure: Creating a Custom Instance

If a module needs an isolated schedule manager (e.g., a plugin with its own lifecycle):

```javascript
import { createFactory } from '@shared/api/engines/schedule';

const pluginSchedule = createFactory({ autoStart: false });
pluginSchedule.register('my-plugin:sync', '*/10 * * * *', syncHandler);
pluginSchedule.start();
```

## Integration with Workers

For CPU-intensive scheduled work, keep the cron handler lightweight and dispatch to a worker pool:

```javascript
export async function init(app) {
  const schedule = app.get('schedule');

  schedule.register('analytics:weekly-report', '0 9 * * 1', async () => {
    const workerPool = app.get('analytics:workerPool');
    await workerPool.sendRequest('weekly-report', 'GENERATE_REPORT', {
      week: getCurrentWeek(),
    });
  });
}
```

## Common Cron Expressions

| Expression | Schedule |
|---|---|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * 1` | Monday at 9 AM |
| `0 0 1 * *` | First of each month |

## Testing Scheduled Tasks

The engine ships with a `__mocks__/node-cron.js` manual mock for Jest. Import `ScheduleManager` directly from the factory to unit-test without real timers:

```javascript
jest.mock('node-cron');
import { ScheduleManager } from '@shared/api/engines/schedule/factory';

describe('MyModule scheduled tasks', () => {
  let manager;

  beforeEach(() => {
    manager = new ScheduleManager({ autoStart: false });
  });

  afterEach(() => manager.cleanup());

  it('should register the cleanup task', () => {
    const handler = jest.fn();
    manager.register('test:cleanup', '0 0 * * *', handler);
    expect(manager.getAllTasks()).toContain('test:cleanup');
  });
});
```

## Best Practices

- **Keep handlers lightweight.** Offload heavy processing to a worker pool.
- **Use descriptive names.** Format: `{module}:{action}` to avoid collisions.
- **Handle errors inside handlers.** The engine wraps handlers in try/catch and logs errors, but explicit handling gives better diagnostics.
- **Log execution.** Always log start/completion inside handlers for debugging cron issues.
- **Respect overwrite warnings.** Re-registering the same name stops the old task and emits a console warning.
