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
├── schedule.test.js      # Jest unit tests
└── __mocks__/
    └── node-cron.js      # Manual Jest mock for node-cron
```

### Dependency Graph

```
index.js
└── factory.js
    └── node-cron (external)
```

## 2. Core Class: `ScheduleManager`

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
| `register` | `(name, cronExpression, handler, options?) → CronTask` | Validates inputs (throws `ScheduleManagerError` with codes `INVALID_TASK_NAME`, `INVALID_CRON_EXPRESSION`, `INVALID_HANDLER`). Overwrites existing same-name task with console warning. Wraps handler in try/catch that logs errors via `console.error`. |
| `unregister` | `(name) → boolean` | Stops task, removes from map. Returns `false` if not found. |
| `get` | `(name) → TaskEntry \| undefined` | Direct `Map.get` lookup. |
| `getAllTasks` | `() → string[]` | Returns `Array.from(this.tasks.keys())`. |
| `isTaskRunning` | `(name) → boolean` | Checks `task.getStatus() === 'scheduled'`. |
| `getStats` | `() → StatsObject` | Iterates all tasks, counts `running`/`stopped`, builds per-task detail. |
| `start` | `() → void` | Sets `autoStart = true`, calls `task.start()` on all entries. |
| `stop` | `() → void` | Sets `autoStart = false`, calls `task.stop()` on all entries. |
| `cleanup` | `() → void` | Stops all tasks, clears the map. |

### Error Handling

All validation errors use a structured error pattern:
```javascript
const error = new Error('...');
error.name = 'ScheduleManagerError';
error.code = 'INVALID_TASK_NAME'; // or INVALID_CRON_EXPRESSION, INVALID_HANDLER
error.status = 400;
throw error;
```

Handler execution errors are caught internally and logged — they do **not** crash the process.

## 3. Factory Function: `createFactory(config?)`

**File:** `factory.js`

- Creates a `ScheduleManager` instance.
- Calls `schedule.start()` unless `config.autoStart === false`.
- Returns the instance.

## 4. Default Singleton

**File:** `index.js`

- Exports `createFactory` and `ScheduleManager` as named exports.
- Exports a default singleton: `const schedule = createFactory()`.
- The singleton is registered on the DI container as `app.get('schedule')` during engine autoloading.

## 5. Testing

**File:** `schedule.test.js`

Uses a manual mock at `__mocks__/node-cron.js` that provides:
- `cron.schedule(expression, callback, options)` — returns a mock task with `start()`, `stop()`, `getStatus()`.
- `cron.validate(expression)` — validates field count (5 or 6 fields).
- `__getMockTasks()` / `__clearMockTasks()` — test helpers.

Tests instantiate `ScheduleManager` directly with `{ autoStart: false }` to avoid side effects.

### Test Coverage

- Input validation (name, cron expression, handler).
- Task registration, overwrite, and unregister.
- `get()`, `getAllTasks()`, `isTaskRunning()`.
- Statistics computation.
- Bulk `start()` / `stop()` / `cleanup()`.
- Handler wrapping and option passthrough.

## 6. Integration Points

- **Module `init(app)`**: Primary registration point. Access via `app.get('schedule')`.
- **Worker Engine**: Cron handlers can dispatch heavy work to worker pools.
- **Plugin lifecycle**: Plugins can create isolated instances via `createFactory()` and manage their own teardown.

---

*Note: This spec reflects the CURRENT implementation of the schedule engine.*
