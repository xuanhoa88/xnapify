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
export async function init(container) {
  const schedule = container.resolve('schedule');

  schedule.register('analytics:daily-rollup', '0 2 * * *', async () => {
    const { models } = container.resolve('db');
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

### `schedule.isTaskScheduled(name) → boolean`

Returns `true` if the task's cron is currently active/scheduled. Note: `isTaskRunning` is maintained as a deprecated alias.

### `schedule.isTaskExecuting(name) → boolean`

Returns `true` if the scheduled handler logic is currently executing (awaiting an async resolution).

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

### `schedule.abort(name) → boolean`

Manually aborts a currently active asynchronous task execution by signaling its `AbortController`. This does NOT stop the underlying cron schedule. Returns `true` if it aborted an active task.

### `schedule.start()` / `schedule.stop()`

Bulk start or stop all registered tasks. Note: `stop()` also sets `autoStart = false`, so tasks registered afterward will not auto-start until `start()` is called again.

### `schedule.cleanup() → Promise<void>`

Stop and remove all tasks. Awaits all active execution promises up to a maximum safety timeout (5000ms), and aborts their signals to forcefully conclude them. Called automatically during coordinated process shutdown via the centralized shutdown registry.

### `schedule.destroy() → Promise<void>`

Calls `cleanup()`. Use this for dynamically spawned instances to release resources.

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

Keep cron handlers lightweight — call worker functions directly for heavy processing:

```javascript
schedule.register('reports:weekly', '0 9 * * 1', async () => {
  const { generateReport } = require('./workers');
  const models = container.resolve('models');
  await generateReport(models, { week: getCurrentWeek() });
});
```

## Custom Instances

For isolated scheduling (e.g., extensions with their own lifecycle):

```javascript
import { createFactory } from '@shared/api/engines/schedule';

const extensionSchedule = createFactory({ autoStart: false });
extensionSchedule.register('extension:sync', '*/10 * * * *', syncHandler);
extensionSchedule.start(); // manually start when ready
```

Each instance registers cleanup with the centralized shutdown registry (`shared/api/shutdown.js`).

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
