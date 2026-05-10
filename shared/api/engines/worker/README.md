# Worker Engine

Elastic thread pool for executing CPU-bound worker functions in isolated `worker_threads`, powered by [piscina](https://github.com/piscinajs/piscina). Prevents heavy computations from blocking the Node.js event loop.

## Quick Start

```javascript
// Resolve from DI container (auto-discovers workers from BUILD_DIR)
const worker = container.resolve('worker');

// Run a function in a thread
const result = await worker.run('math', 'fibonacci', { n: 42 });
// → { n: 42, result: 267914296, elapsed: 5 }
```

## When to Use

| Scenario                        | Use Thread Pool? | Why                          |
| ------------------------------- | ---------------- | ---------------------------- |
| Fibonacci, prime sieve, hashing | ✅ Yes           | CPU-bound, blocks event loop |
| Image/PDF processing            | ✅ Yes           | CPU-intensive transforms     |
| Database queries                | ❌ No            | I/O-bound, needs `models`    |
| Search indexing                 | ❌ No            | Needs DI container           |
| File upload/download            | ❌ No            | I/O-bound, needs FS engine   |
| Email sending                   | ❌ No            | I/O-bound, needs provider    |

**Rule of thumb**: If the worker needs `container`, `models`, `search`, or `db`, it must stay as a direct function call.

## API Reference

### `worker.run(workerName, fnName, data, options)`

Run a function in a thread. Uses `AbortController` for timeout and cancellation —
when aborted, piscina terminates the worker thread (no zombie tasks).

- **workerName** `string` — Registered worker name (e.g., `'math'`)
- **fnName** `string` — Export function name (e.g., `'fibonacci'`)
- **data** `any` — Serializable payload
- **options.timeout** `number` — Override task timeout (ms)
- **Returns** `Promise<any>` — Worker function return value

### `worker.registerWorker(name, absolutePath)`

Manually register a worker file path.

### `worker.unregisterWorker(name)`

Unregister a worker by name. This:

1. **Cancels all in-flight tasks** for this worker (piscina terminates the thread)
2. **Clears `require.cache`** for the worker file to free memory
3. **Removes the worker** from the manifest

### `worker.discoverWorkers(baseDir)`

Scan a directory recursively for `*.worker.js` files that contain the `WORKER_POOL` marker and register them with:

- **Namespaced key** (relative path, e.g., `extensions/my_plugin/math`) — always unique
- **Short alias** (basename, e.g., `math`) — only when the basename is unique across all files

> Workers without `WORKER_POOL` in their compiled output are skipped (they're Tier 1 — direct import only).

### `worker.getStats()`

Returns pool statistics:

```javascript
{
  threads: { total: 3, idle: 2, active: 1, min: 1, max: 7 },
  tasks: { completed: 42, queued: 0 },
  workers: ['math', 'text']
}
```

### `worker.cleanup()`

Gracefully terminate all threads. Aborts all in-flight tasks and rejects queued tasks.

## Configuration

| Environment Variable          | Default    | Description           |
| ----------------------------- | ---------- | --------------------- |
| `XNAPIFY_WORKER_MIN_THREADS`  | `1`        | Always-warm threads   |
| `XNAPIFY_WORKER_MAX_THREADS`  | `cpus - 1` | Thread ceiling        |
| `XNAPIFY_WORKER_IDLE_TIMEOUT` | `30000`    | Idle termination (ms) |
| `XNAPIFY_WORKER_TASK_TIMEOUT` | `30000`    | Per-task timeout (ms) |
| `XNAPIFY_WORKER_QUEUE_MAX`    | `100`      | Max queued tasks      |

## Writing a Threadable Worker

```javascript
// my-task.worker.js

/** Marks this worker as eligible for thread pool execution. */
export const WORKER_POOL = true;

/**
 * @param {{ input: string }} data - Must be JSON-serializable
 * @returns {{ result: string }} - Must be JSON-serializable
 */
export function processTask(data) {
  // CPU-intensive work here...
  return { result: 'done' };
}
```

**Requirements for thread pool workers:**

1. Export `WORKER_POOL = true`
2. All inputs/outputs must be JSON-serializable
3. No imports of DI-dependent modules (`container`, `models`, `search`)
4. Pure functions only — no side effects on shared state

## Troubleshooting

### `WORKER_NOT_FOUND`

The worker wasn't discovered. Check:

- Does the worker file `export const WORKER_POOL = true`?
- Was the `*.worker.js` file compiled by rspack?
- Is the file in `BUILD_DIR` or a subdirectory?
- Does the filename end with `.worker.js`?

### `WORKER_TIMEOUT`

The worker function timed out or was cancelled. This happens when:

- The task exceeded `XNAPIFY_WORKER_TASK_TIMEOUT`
- `unregisterWorker()` was called while the task was running

Options:

- Increase `XNAPIFY_WORKER_TASK_TIMEOUT`
- Pass `{ timeout: 60000 }` as options to `run()`
- Optimize the worker function

### `QUEUE_FULL`

All threads are busy and the queue is full. Options:

- Increase `XNAPIFY_WORKER_MAX_THREADS`
- Increase `XNAPIFY_WORKER_QUEUE_MAX`
- Rate-limit incoming requests

---

# Worker Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the
> Worker Engine at `shared/api/engines/worker`.

---

## Objective

The Worker engine provides an elastic thread pool for executing CPU-bound worker functions in isolated `worker_threads`. Built on top of [piscina](https://github.com/piscinajs/piscina), it bridges rspack-compiled `*.worker.js` files (standalone CJS modules) with Node.js `worker_threads` at runtime, preventing CPU-intensive tasks from blocking the main event loop.

## Two-Tier Worker System

The project has two categories of workers:

| Tier                    | Type                      | Execution                        | When to Use                                           |
| ----------------------- | ------------------------- | -------------------------------- | ----------------------------------------------------- |
| **Tier 1: Direct**      | DI-dependent, I/O-bound   | Same-process function call       | Workers needing `container`, `models`, `search`, `db` |
| **Tier 2: Thread Pool** | Pure functions, CPU-bound | `worker_threads` via this engine | Workers with serializable I/O only                    |

**Tier 1 examples**: `search.worker.js`, `activities.worker.js`, `fs/workers/index.js`, `send.worker.js`
**Tier 2 examples**: `math.worker.js`, `text.worker.js`

Tier 2 workers export `WORKER_POOL = true` to signal pool eligibility.

## 1. Architecture

```
shared/api/engines/worker/
├── index.js              # Singleton + re-exports (DI key: 'worker')
├── factory.js            # WorkerPoolManager facade over piscina
├── errors.js             # WorkerError class
├── README.md             # This file
└── worker.test.js        # Jest unit tests
```

### Dependency Graph

```
index.js
└── factory.js
    ├── piscina (npm — handles threads, pooling, module loading)
    └── errors.js
```

### Runtime Flow

```
pool.run('math', 'fibonacci', { n: 42 })
       │
       ▼
WorkerPoolManager.run()
  → manifest.get('math')  → workerPath
  → Promise.race([
      piscina.run(data, { filename: workerPath, name: 'fibonacci' }),
      timeoutPromise
    ])
       │
       ▼
piscina (internally):
  → picks idle thread or spawns new one
  → loads workerPath as CJS module
  → calls exports.fibonacci(data)
  → returns result to main thread
       │
       ▼
Result or WorkerError
```

## 2. WorkerPoolManager Class (`factory.js`)

### Constructor

```javascript
new WorkerPoolManager({
  minThreads: 1, // Always-warm threads
  maxThreads: cpus - 1, // Elastic ceiling
  idleTimeout: 30000, // Idle thread termination (ms)
  taskTimeout: 30000, // Per-task timeout (ms)
  maxQueueSize: 100, // Max queued tasks before rejection
});
```

The constructor creates a shared `Piscina` instance with these options. Thread lifecycle (elastic scaling, idle termination, self-healing) is managed by piscina.

### Key Methods

| Method                          | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| `discoverWorkers(baseDir)`      | Scan directory recursively for `*.worker.js` files        |
| `registerWorker(name, absPath)` | Manually register a worker file (validates absolute path) |
| `unregisterWorker(name)`        | Remove a registered worker                                |
| `hasWorker(name)`               | Check if worker is registered                             |
| `getWorkerNames()`              | List all registered worker names                          |
| `run(worker, fn, data, opts)`   | Execute function in thread pool via piscina               |
| `getStats()`                    | Pool statistics (threads, tasks, workers)                 |
| `cleanup()`                     | Graceful shutdown via `piscina.destroy()`                 |

## 3. Configuration / Environment Variables

| Variable                      | Default    | Description                 |
| ----------------------------- | ---------- | --------------------------- |
| `XNAPIFY_WORKER_MIN_THREADS`  | `1`        | Minimum always-warm threads |
| `XNAPIFY_WORKER_MAX_THREADS`  | `cpus - 1` | Maximum threads             |
| `XNAPIFY_WORKER_IDLE_TIMEOUT` | `30000`    | Idle thread timeout (ms)    |
| `XNAPIFY_WORKER_TASK_TIMEOUT` | `30000`    | Per-task timeout (ms)       |
| `XNAPIFY_WORKER_QUEUE_MAX`    | `100`      | Max queued tasks            |

## 4. Worker Discovery

At startup, `createFactory()` calls `discoverWorkers(BUILD_DIR)` which recursively scans the build output for `*.worker.js` files. Each file is `require()`'d to verify `exports.WORKER_POOL === true` before registration — non-pool workers (Tier 1) are skipped. Worker names are derived from filenames (e.g., `math.worker.js` → `'math'`).

Typical build output structure:

```
BUILD_DIR/
├── workers/{appName}/{name}.worker.js      # Core app workers
└── extensions/{extName}/workers/{name}.worker.js  # Extension workers
```

Extensions can also call `registerWorker()` directly for dynamic registration.

### Unregistration

`unregisterWorker(name)` performs a clean teardown:

1. **Cancels in-flight tasks** via `AbortController.abort()` — piscina terminates the worker thread
2. **Clears `require.cache`** for the worker file to free memory
3. **Removes the name→path mapping** from the manifest

## 5. Error Handling

| Code                     | Status | Description                                              |
| ------------------------ | ------ | -------------------------------------------------------- |
| `WORKER_NOT_FOUND`       | 404    | Worker name not in manifest                              |
| `WORKER_TIMEOUT`         | 408    | Task timed out or was cancelled via `unregisterWorker()` |
| `WORKER_EXECUTION_ERROR` | 500    | Worker function threw an error                           |
| `POOL_TERMINATED`        | 503    | Pool was shut down                                       |
| `INVALID_ARGUMENT`       | 400    | Invalid worker name/path                                 |
| `INVALID_PATH`           | 400    | Relative path (must be absolute)                         |

## 6. Integration Points

### From Extensions

```javascript
// In boot():
const worker = container.resolve('worker');
const result = await worker.run('math', 'fibonacci', { n: 42 });
```

### From Core Modules

```javascript
// In barrel (workers/index.js):
export async function computeExpensive(data) {
  const worker = container.resolve('worker');
  return await worker.run('myWorker', 'compute', data);
}
```

### Marking Workers as Threadable

```javascript
// In *.worker.js:
export const WORKER_POOL = true; // Signal to reviewers and tooling
```

## 7. Testing

Test file: `worker.test.js` — 22 tests covering:

- Constructor & config clamping
- Piscina pool creation
- Manifest loading (file + manual registration)
- Path validation (rejects relative paths)
- Task delegation to piscina
- Timeout via Promise.race
- Pool stats
- Cleanup & idempotency
- Factory shutdown registry integration
- WorkerError class

---

_Note: This spec reflects the CURRENT piscina-based implementation._
