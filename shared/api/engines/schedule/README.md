# Schedule Engine

Cron-based task scheduling for recurring background work. Wraps `node-cron` behind a managed `ScheduleManager` with dynamic registration, graceful shutdown, and runtime statistics.

## Quick Start

```javascript
import schedule from '@shared/api/engines/schedule';

// Register a daily task at midnight UTC
schedule.register('billing:invoice-reminders', '0 0 * * *', async () => {
  const overdueInvoices = await findOverdueInvoices();
  await sendReminderEmails(overdueInvoices);
});
```

Inside a module's `init()` lifecycle hook:

```javascript
export async function init(app) {
  const schedule = app.get('schedule');

  schedule.register('analytics:daily-rollup', '0 2 * * *', async () => {
    const { models } = app.get('db');
    await models.AnalyticsRollup.computeDaily();
  });
}
```

## API

### `schedule.register(name, cronExpression, handler, options?)`

Register a cron task. Validates inputs, then delegates to `node-cron`. The handler is wrapped in a try/catch that logs errors via `console.error` but never propagates them to `node-cron`.

| Param | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | *required* | Unique task identifier (convention: `module:action`) |
| `cronExpression` | `string` | *required* | Standard cron expression (5 or 6 fields) |
| `handler` | `Function` | *required* | Async function to execute on each tick |
| `options.scheduled` | `boolean` | `autoStart` | Whether to start immediately. Falls back to the manager's `autoStart` flag |
| `options.timezone` | `string` | `'UTC'` | IANA timezone for execution |

**Validation:** Throws `ScheduleError` with codes `INVALID_TASK_NAME`, `INVALID_CRON_EXPRESSION`, or `INVALID_HANDLER`. Expression is validated both as a non-empty string and via `cron.validate()`.

**Overwrite:** If a task with the same name exists, it is stopped and removed with a console warning before the new one is registered.

### `schedule.unregister(name) → boolean`

Stop and remove a task. Returns `true` if found, `false` otherwise.

### `schedule.get(name) → TaskEntry | undefined`

Get task info: `{ task, expression, options, registeredAt }`.

### `schedule.getAllTasks() → string[]`

Returns array of registered task names.

### `schedule.isTaskRunning(name) → boolean`

Returns `true` if the task's status is `'scheduled'`.

### `schedule.getStats() → StatsObject`

```javascript
{
  total: number,
  running: number,
  stopped: number,
  tasks: {
    [name]: { expression, status, timezone, registeredAt }
  }
}
```

### `schedule.start()` / `schedule.stop()`

Bulk start or stop all registered tasks. Note: `stop()` also sets `autoStart = false`, so tasks registered afterward will not auto-start until `start()` is called again.

### `schedule.cleanup()`

Stop and remove all tasks. Called automatically on `SIGTERM` and `SIGINT`.

### `ScheduleError`

Structured error class. Properties: `name`, `code`, `statusCode`, `timestamp`.

```javascript
import { ScheduleError } from '@shared/api/engines/schedule';
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

## Worker Integration

Keep cron handlers lightweight — dispatch heavy processing to a worker pool:

```javascript
schedule.register('reports:weekly', '0 9 * * 1', async () => {
  const workerPool = app.get('reports:workerPool');
  await workerPool.sendRequest('weekly', 'GENERATE_REPORT', {
    week: getCurrentWeek(),
  });
});
```

## Custom Instances

For isolated scheduling (e.g., plugins with their own lifecycle):

```javascript
import { createFactory } from '@shared/api/engines/schedule';

const pluginSchedule = createFactory({ autoStart: false });
pluginSchedule.register('my-plugin:sync', '*/10 * * * *', syncHandler);
pluginSchedule.start(); // manually start when ready
```

Each instance registers its own `SIGTERM`/`SIGINT` cleanup handlers.

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
