---
id: architecture-shutdown
title: Graceful Shutdown
sidebar_position: 6
---

# Graceful Shutdown Registry

The **xnapify** framework implements a **Centralized Shutdown Registry** (`shared/api/shutdown.js`) to coordinate the cleanup and teardown phases of all backend engines, database connections, and background tasks.

Instead of each module or engine blindly hooking into `process.once('SIGTERM')`, they register their cleanup logic into this central coordinator. 

## Why a Central Registry?

1. **Hot Module Replacement (HMR) Stability**: During development, Webpack HMR re-evaluates the server bundle frequently. If each factory registered its own signal handler, every hot-reload would stack a *new* listener closure. After N reloads, the process exit would fire N+1 cleanup routines per engine. The Central Registry uses idempotent registration (`Map.set`), so re-imports gracefully overwrite the exact same key without memory leaks.
2. **Predictable Ordering**: In a complex application, teardown order is critical. You cannot close the database connection while a background queue is still flushing its jobs. The registry introduces **position-based execution**.
3. **Global Timeout Safety**: The shutdown process is wrapped in a hard timeout (`DEFAULT_TIMEOUT = 30,000ms`). If a cleanup handler hangs or deadlocks, the registry ensures the Node.js process will still eventually exit.

---

## Execution Model

When the server initiates shutdown (e.g., catching `SIGTERM`), the registry executes the drain sequence:

1. Handlers are sorted **high → low** by their `position` integer.
2. Handlers sharing the same position run **in parallel** via `Promise.allSettled`.
3. Position batches execute **sequentially** (the highest position must complete fully before the next lower batch begins).

This declarative approach guarantees constraints are respected:

```
Position 20 ─ http        (stop accepting new HTTP traffic first)
Position 10 ─ queue, hook (drain active background work, finish cron jobs)
Position  0 ─ cache, db   (safely close low-level persistent resources last)
```

---

## Example: The Schedule Engine

A prime example of this architecture is the internal **Schedule Engine**. 

When you register a cron task via the Schedule Engine, you do **not** need to manually stop the cron or abort the logic during app shutdown. The engine factory natively registers itself with the shutdown coordinator at priority `10`:

```javascript
// From shared/api/engines/schedule/factory.js
export function createFactory(config = {}) {
  const schedule = new ScheduleManager(config);

  // Register with centralized shutdown coordinator at priority 10
  register('schedule', () => schedule.cleanup(), 10);

  return schedule;
}
```

### How the Schedule Cleanup Works

When the central registry calls `schedule.cleanup()`, the engine:
1. Iterates through every registered cron task and calls `.stop()` to prevent future ticks.
2. Identifies any task that is *currently executing*.
3. Fires the internal `AbortController` (which your handler should capture via the `{ signal }` parameter) to natively abort long-running ORM queries or fetch requests.
4. Gives the active Promises up to `5000ms` to gracefully settle before forcefully purging them from memory.

---

## Registering Custom Cleanup

If you build a custom engine, extension, or singleton connection that needs cleanup, you can import the registry and append your logic:

```javascript
import { register } from '@shared/api/shutdown';

export function createMyCustomEngine() {
  const engine = new MyCustomEngine();
  
  // Register idempotent cleanup logic
  register(
    'myCustomEngine',        // Unique key (overwrites on HMR)
    () => engine.teardown(), // Async-safe function
    15                       // Position (runs before priority 10, after 20)
  );

  return engine;
}
```
