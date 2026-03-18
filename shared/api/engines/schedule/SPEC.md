# Schedule Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture and implementation details of the Schedule Engine at `shared/api/engines/schedule`.
> This engine provides cron-based task scheduling wrapped around `node-cron`.

---

## Objective

Provide a managed cron scheduling layer that modules and plugins can use to register, monitor, and control recurring background tasks with automatic lifecycle management.

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

Extends `Error` with structured properties for consistent error handling across the engine, following the same pattern as the worker engine's `WorkerError`.

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
| `INVALID_TASK_NAME` | `register()` | Name is empty or not a string |
| `INVALID_CRON_EXPRESSION` | `register()` | Expression is empty, not a string, or fails `cron.validate()` |
| `INVALID_HANDLER` | `register()` | Handler is not a function |

## 3. Core Class: `ScheduleManager`

**File:** `factory.js`

### Constructor

- `config.autoStart` (boolean, default `true`) — controls whether tasks auto-start on registration.

### Internal State

- `this.tasks` — `Map<string, TaskEntry>` where `TaskEntry` is:
  ```
  { task: CronTask, expression: string, options: object, registeredAt: string }
  ```
- `this.autoStart` — mutable flag toggled by `start()` / `stop()`.

### Methods

| Method | Signature | Behavior |
|---|---|---|
| `register` | `(name, cronExpression, handler, options?) → CronTask` | Validates inputs (throws `ScheduleError` with codes `INVALID_TASK_NAME`, `INVALID_CRON_EXPRESSION`, `INVALID_HANDLER`). Overwrites existing same-name task with console warning. Wraps handler in try/catch that logs errors via `console.error`. |
| `unregister` | `(name) → boolean` | Stops task, removes from map. Returns `false` if not found. |
| `get` | `(name) → TaskEntry \| undefined` | Direct `Map.get` lookup. |
| `getAllTasks` | `() → string[]` | Returns `Array.from(this.tasks.keys())`. |
| `isTaskRunning` | `(name) → boolean` | Checks `task.getStatus() === 'scheduled'`. |
| `getStats` | `() → StatsObject` | Iterates all tasks, counts `running`/`stopped`, builds per-task detail. |
| `start` | `() → void` | Sets `autoStart = true`, calls `task.start()` on all entries. |
| `stop` | `() → void` | Sets `autoStart = false`, calls `task.stop()` on all entries. **Note:** This disables auto-start for future registrations until `start()` is called again. |
| `cleanup` | `() → void` | Stops all tasks, clears the map. |

## 4. Factory Function: `createFactory(config?)`

**File:** `factory.js`

- Creates a `ScheduleManager` instance.
- Registers `process.once('SIGTERM')` and `process.once('SIGINT')` handlers that call `schedule.cleanup()` on process termination.
- Returns the instance.

## 5. Default Singleton

**File:** `index.js`

- Exports `createFactory`, `ScheduleManager`, and `ScheduleError` as named exports.
- Exports a default singleton: `const schedule = createFactory()`.
- The singleton is registered on the DI container as `app.get('schedule')` during engine autoloading.

## 6. Testing

**File:** `schedule.test.js`

Uses a manual mock at `__mocks__/node-cron.js` that provides:
- `cron.schedule(expression, callback, options)` — returns a mock task with `start()`, `stop()`, `getStatus()`, and the stored `_callback`.
- `cron.validate(expression)` — validates field count (5 or 6 fields).
- `__getMockTasks()` / `__clearMockTasks()` — test helpers.

Tests instantiate `ScheduleManager` directly with `{ autoStart: false }` to avoid side effects.

### Test Coverage

- Input validation (name, cron expression, handler) with `ScheduleError` assertions.
- Task registration, overwrite, and unregister.
- `get()`, `getAllTasks()`, `isTaskRunning()`.
- Statistics computation.
- Bulk `start()` / `stop()` / `cleanup()`.
- Handler callback invocation and error logging via mock.
- `createFactory()` signal registration and cleanup behavior.
- `ScheduleError` class properties and inheritance.

## 7. Integration Points

- **Module `init(app)`**: Primary registration point. Access via `app.get('schedule')`.
- **Worker Engine**: Cron handlers can dispatch heavy work to worker pools.
- **Plugin lifecycle**: Plugins can create isolated instances via `createFactory()` and manage their own teardown.

---

*Note: This spec reflects the CURRENT implementation of the schedule engine.*
