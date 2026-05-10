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

| Param               | Type       | Default     | Description                                                                |
| ------------------- | ---------- | ----------- | -------------------------------------------------------------------------- |
| `name`              | `string`   | _required_  | Unique task identifier (convention: `module:action`)                       |
| `cronExpression`    | `string`   | _required_  | Standard cron expression (5 or 6 fields)                                   |
| `handler`           | `Function` | _required_  | Async function to execute on each tick                                     |
| `options.scheduled` | `boolean`  | `autoStart` | Whether to start immediately. Falls back to the manager's `autoStart` flag |
| `options.timezone`  | `string`   | `'UTC'`     | IANA timezone for execution                                                |

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

| Expression    | Schedule            |
| ------------- | ------------------- |
| `* * * * *`   | Every minute        |
| `*/5 * * * *` | Every 5 minutes     |
| `0 * * * *`   | Every hour          |
| `0 0 * * *`   | Daily at midnight   |
| `0 9 * * 1`   | Monday at 9 AM      |
| `0 0 1 * *`   | First of each month |

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

---

# Schedule Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture and implementation details of the Schedule Engine at `shared/api/engines/schedule`.
> This engine provides cron-based task scheduling wrapped around `node-cron`.

---

## Objective

Provide a managed cron scheduling layer that modules and extensions can use to register, monitor, and control recurring background tasks with automatic lifecycle management and graceful shutdown.

## 1. Architecture

```
shared/api/engines/schedule/
├── index.js              # Default singleton export + re-exports
├── factory.js            # ScheduleManager class + createFactory()
├── errors.js             # ScheduleError class
├── schedule.test.js      # Jest unit tests
└── __mocks__/
    └── nodeCron.js      # Manual Jest mock for node-cron
```

### Dependency Graph

```
index.js
├── factory.js
│   ├── node-cron (external)
│   └── errors.js
└── errors.js
```

## 2. Error Class: `ScheduleError`

**File:** `errors.js`

Extends `Error` with structured properties for consistent error handling across engines.

| Property     | Type     | Default            | Description                        |
| ------------ | -------- | ------------------ | ---------------------------------- |
| `name`       | `string` | `'ScheduleError'`  | Error name for `instanceof` checks |
| `code`       | `string` | `'SCHEDULE_ERROR'` | Machine-readable error code        |
| `statusCode` | `number` | `400`              | HTTP-compatible status code        |
| `timestamp`  | `string` | ISO 8601           | When the error was created         |

Uses `Error.captureStackTrace` for clean stack traces.

### Error Codes

| Code                      | Thrown By    | Meaning                                                       |
| ------------------------- | ------------ | ------------------------------------------------------------- |
| `INVALID_TASK_NAME`       | `register()` | Name is falsy or not a string                                 |
| `INVALID_CRON_EXPRESSION` | `register()` | Expression is falsy, not a string, or fails `cron.validate()` |
| `INVALID_HANDLER`         | `register()` | Handler is not a function                                     |

## 3. Core Class: `ScheduleManager`

**File:** `factory.js`

### Constructor

- `config.autoStart` (boolean, default `true`) — controls whether tasks start automatically on registration.
- Initializes `this.tasks` as an empty `Map`.

### Internal State

- `this.tasks` — `Map<string, TaskEntry>` where `TaskEntry` is:
  ```
  { task: CronTask, expression: string, options: object, registeredAt: string, isExecuting: boolean, abortController: AbortController | null, activePromise: Promise | null }
  ```
- `this.autoStart` — mutable flag; set to `true` by `start()`, `false` by `stop()`.
- `this.cleanupTimeout` — wait limit for gracefully aborting active tasks during cleanup (default: 5000ms).

### Methods

#### `register(name, cronExpression, handler, options?) → CronTask`

Registers a cron task with two-phase validation:

1. **Input validation** — validates `name` (non-empty string), `cronExpression` (non-empty string), and `handler` (function). Throws `ScheduleError` with specific codes.
2. **Overwrite check** — if a task with the same `name` exists, logs a warning and calls `unregister(name)` to stop and remove the old task before proceeding.
3. **Cron validation** — calls `cron.validate(cronExpression)`. Throws `ScheduleError` with code `INVALID_CRON_EXPRESSION` if invalid.
4. **Scheduling** — calls `cron.schedule()` with:
   - The handler wrapped in an overlapping execution guard (`if (item.isExecuting) return;`).
   - Generates an `AbortController` and executes `handler({ signal: abortController.signal })`.
   - Errors are caught and logged, never propagated to `node-cron`.
   - `scheduled`: `options.scheduled` if explicitly set, otherwise falls back to `this.autoStart`.
   - `timezone`: `options.timezone || 'UTC'`.
5. **Storage** — stores `{ task, expression, options, registeredAt, isExecuting, abortController, activePromise }` in `this.tasks`.
6. Logs registration via `console.info`.

#### `abort(name) → boolean`

Triggers the `abortController.abort()` for a currently running handler, allowing you to forcefully cancel its asynchronous operation without dropping its cron cadence. Returns `true` if it effectively invoked abort on an active task.

#### `unregister(name) → boolean`

Calls `task.stop()`, aborts any active execution via `this.abort(name)`, and removes from map. Returns `false` if name not found. Logs via `console.info`.

#### `get(name) → TaskEntry | undefined`

Direct `Map.get` lookup. Returns the full entry object.

#### `getAllTasks() → string[]`

Returns `Array.from(this.tasks.keys())`.

#### `isTaskScheduled(name) → boolean` (formerly `isTaskRunning`)

Returns `true` if `task.getStatus() === 'scheduled'` if found, `false` otherwise.

#### `isTaskExecuting(name) → boolean`

Returns `true` if the cron's asynchronous handler logic is currently resolving (via `item.isExecuting`).

#### `getStats() → StatsObject`

Iterates all tasks and returns:

```javascript
{
  total: number,
  running: number,   // status === 'scheduled'
  stopped: number,   // status !== 'scheduled'
  tasks: {
    [name]: { expression, status, timezone, registeredAt }
  }
}
```

The `timezone` field reads from `item.options.timezone` with a fallback to `'UTC'`.

#### `start() → void`

Sets `this.autoStart = true`, calls `task.start()` on all entries. Logs each start.

#### `stop() → void`

Sets `this.autoStart = false`, calls `task.stop()` on all entries. **Side effect:** tasks registered after `stop()` will NOT auto-start until `start()` is called again.

#### `cleanup() → Promise<void>`

Stops all tasks via `task.stop()`. Then aborts any active execution controllers.
Awaits all `activePromise` entries using `Promise.allSettled()` up to a racing `this.cleanupTimeout` limit before forcefully wiping the tasks map.
Called automatically on process termination signals.

## 4. Factory Function: `createFactory(config?)`

**File:** `factory.js`

- Creates a `ScheduleManager` instance with the given config.
- Registers the engine's cleanup handler with the centralized shutdown registry (`shared/api/shutdown.js`).
- Returns the instance.

## 5. Default Singleton

**File:** `index.js`

### Named Exports

- `createFactory` — factory function for custom instances.
- `ScheduleManager` — class for type referencing and extension.
- `ScheduleError` — error class.

### Default Export

```javascript
const schedule = createFactory();
export default schedule;
```

The singleton is registered on the DI container as `container.resolve('schedule')` during engine autoloading.

The `index.js` file also contains comprehensive JSDoc with `@example` blocks covering registration, timezone options, worker integration, and task management.

## 6. Testing

**File:** `schedule.test.js`

### Mock Setup

Uses a manual mock at `__mocks__/nodeCron.js`:

- `cron.schedule(expression, callback, options)` — returns a mock task with `start()`, `stop()`, `getStatus()` (tracks `'scheduled'` / `'stopped'` state), and the stored `_callback` for direct invocation in tests.
- `cron.validate(expression)` — validates field count (5 or 6 space-separated fields).
- `__getMockTasks()` / `__clearMockTasks()` — test helpers.

Tests instantiate `ScheduleManager` directly with `{ autoStart: false }` to avoid side effects.

### Test Coverage (4 describe blocks)

**ScheduleManager:**

- Input validation: name (empty, `null`, non-string), cron expression (empty, invalid), handler (string, `null`).
- `ScheduleError` assertions: `instanceof`, `code`, `statusCode`.
- Task registration with options, timezone, `registeredAt` timestamp.
- Overwrite behavior with console warning assertion.
- `unregister()`: found vs. not-found paths.
- `get()`, `getAllTasks()`, `isTaskRunning()`.
- `getStats()`: empty and multi-task with running/stopped counts.
- `start()` / `stop()`: bulk state transitions, `autoStart` flag mutation.
- `cleanup()`: clears all tasks, safe on empty manager.
- Handler wrapping: invocation on cron tick, error catch + `console.error` logging without propagation.

**ScheduleError:**

- Default properties (`name`, `code`, `statusCode`, `timestamp`).
- Custom `code` and `statusCode`.
- Stack trace presence.

**createFactory():**

- Returns `ScheduleManager` instance.
- Registers cleanup with centralized shutdown registry.
- Default `autoStart: true` vs. explicit `autoStart: false`.

## 7. Integration Points

- **Module `boot({ container })`**: Primary registration point. Access via `container.resolve('schedule')`.
- **Worker Functions**: Cron handlers can call worker functions directly for processing (keep handlers lightweight, offload to imported worker functions).
- **Extension lifecycle**: Extensions can create isolated instances via `createFactory()` and manage their own teardown.

---

_Note: This spec reflects the CURRENT implementation of the schedule engine._
