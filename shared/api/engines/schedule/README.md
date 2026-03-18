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

Register a cron task.

| Param | Type | Description |
|---|---|---|
| `name` | `string` | Unique task identifier (convention: `module:action`) |
| `cronExpression` | `string` | Standard cron expression (5 or 6 fields) |
| `handler` | `Function` | Async function to execute on each tick |
| `options.scheduled` | `boolean` | Auto-start on registration (default: `true`) |
| `options.timezone` | `string` | IANA timezone (default: `'UTC'`) |

### `schedule.unregister(name)`

Stop and remove a task. Returns `true` if found.

### `schedule.get(name)`

Get task info object: `{ task, expression, options, registeredAt }`.

### `schedule.getAllTasks()`

Returns array of registered task names.

### `schedule.isTaskRunning(name)`

Returns `true` if the task exists and is in `'scheduled'` state.

### `schedule.getStats()`

Returns `{ total, running, stopped, tasks: { [name]: { expression, status, timezone, registeredAt } } }`.

### `schedule.start()` / `schedule.stop()`

Bulk start or stop all registered tasks.

### `schedule.cleanup()`

Stop and remove all tasks. Called automatically on process termination.

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

For heavy processing, keep cron handlers lightweight and dispatch to a worker pool:

```javascript
schedule.register('reports:weekly', '0 9 * * 1', async () => {
  const workerPool = app.get('reports:workerPool');
  await workerPool.sendRequest('weekly', 'GENERATE_REPORT', { week: getCurrentWeek() });
});
```

## Custom Instances

For isolated scheduling (e.g., plugins with their own lifecycle):

```javascript
import { createFactory } from '@shared/api/engines/schedule';

const pluginSchedule = createFactory({ autoStart: false });
pluginSchedule.register('my-plugin:sync', '*/10 * * * *', syncHandler);
pluginSchedule.start();
```

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
