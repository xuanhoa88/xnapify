# Schedule Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture and implementation details of the Schedule Engine at `shared/api/engines/schedule`.
> This engine provides cron-based task scheduling wrapped around `node-cron`.

---

## Objective

Provide a managed cron scheduling layer that modules and plugins can use to register, monitor, and control recurring background tasks with automatic lifecycle management and graceful shutdown.

## 1. Architecture

```
shared/api/engines/schedule/
├── index.js              # Default singleton export + re-exports
├── factory.js            # ScheduleManager class + createFactory()
├── errors.js             # ScheduleError class
├── schedule.test.js      # Jest unit tests
└── __mocks__/
    └── node-cron.js      # Manual Jest mock for node-cron
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

Extends `Error` with structured properties for consistent error handling, following the same pattern as the worker engine's `WorkerError`.

| Property | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `'ScheduleError'` | Error name for `instanceof` checks |
| `code` | `string` | `'SCHEDULE_ERROR'` | Machine-readable error code |
| `statusCode` | `number` | `400` | HTTP-compatible status code |
| `timestamp` | `string` | ISO 8601 | When the error was created |

Uses `Error.captureStackTrace` for clean stack traces.

### Error Codes

| Code | Thrown By | Meaning |
|---|---|---|
| `INVALID_TASK_NAME` | `register()` | Name is falsy or not a string |
| `INVALID_CRON_EXPRESSION` | `register()` | Expression is falsy, not a string, or fails `cron.validate()` |
| `INVALID_HANDLER` | `register()` | Handler is not a function |

## 3. Core Class: `ScheduleManager`

**File:** `factory.js`

### Constructor

- `config.autoStart` (boolean, default `true`) — controls whether tasks start automatically on registration.
- Initializes `this.tasks` as an empty `Map`.

### Internal State

- `this.tasks` — `Map<string, TaskEntry>` where `TaskEntry` is:
  ```
  { task: CronTask, expression: string, options: object, registeredAt: string }
  ```
- `this.autoStart` — mutable flag; set to `true` by `start()`, `false` by `stop()`.

### Methods

#### `register(name, cronExpression, handler, options?) → CronTask`

Registers a cron task with two-phase validation:

1. **Input validation** — validates `name` (non-empty string), `cronExpression` (non-empty string), and `handler` (function). Throws `ScheduleError` with specific codes.
2. **Overwrite check** — if a task with the same `name` exists, logs a warning and calls `unregister(name)` to stop and remove the old task before proceeding.
3. **Cron validation** — calls `cron.validate(cronExpression)`. Throws `ScheduleError` with code `INVALID_CRON_EXPRESSION` if invalid.
4. **Scheduling** — calls `cron.schedule()` with:
   - The handler wrapped in `async () => try { await handler() } catch { console.error(...) }` — errors are caught and logged, never propagated to `node-cron`.
   - `scheduled`: `options.scheduled` if explicitly set, otherwise falls back to `this.autoStart`.
   - `timezone`: `options.timezone || 'UTC'`.
5. **Storage** — stores `{ task, expression, options, registeredAt }` in `this.tasks`.
6. Logs registration via `console.info`.

#### `unregister(name) → boolean`

Calls `task.stop()`, removes from map. Returns `false` if name not found. Logs via `console.info`.

#### `get(name) → TaskEntry | undefined`

Direct `Map.get` lookup. Returns the full entry object.

#### `getAllTasks() → string[]`

Returns `Array.from(this.tasks.keys())`.

#### `isTaskRunning(name) → boolean`

Returns `task.getStatus() === 'scheduled'` if found, `false` otherwise.

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

#### `cleanup() → void`

Stops all tasks via `task.stop()`, then clears the entire map. Called automatically on process termination signals.

## 4. Factory Function: `createFactory(config?)`

**File:** `factory.js`

- Creates a `ScheduleManager` instance with the given config.
- Registers `process.once('SIGTERM')` and `process.once('SIGINT')` handlers that call `schedule.cleanup()` on process termination.
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

Uses a manual mock at `__mocks__/node-cron.js`:
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
- Registers `SIGTERM` and `SIGINT` via `process.once`.
- Default `autoStart: true` vs. explicit `autoStart: false`.
- Signal handler triggers `cleanup()`.

## 7. Integration Points

- **Module `init(container)`**: Primary registration point. Access via `container.resolve('schedule')`.
- **Worker Engine**: Cron handlers can dispatch heavy work to worker pools (keep handlers lightweight, offload to `workerPool.sendRequest()`).
- **Plugin lifecycle**: Plugins can create isolated instances via `createFactory()` and manage their own teardown.

---

*Note: This spec reflects the CURRENT implementation of the schedule engine.*
