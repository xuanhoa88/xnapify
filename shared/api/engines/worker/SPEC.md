# Worker Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the
> Worker Engine at `shared/api/engines/worker`.

---

## Objective

The Worker engine provides an elastic thread pool for executing CPU-bound worker functions in isolated `worker_threads`. Built on top of [piscina](https://github.com/piscinajs/piscina), it bridges webpack-compiled `*.worker.js` files (standalone CJS modules) with Node.js `worker_threads` at runtime, preventing CPU-intensive tasks from blocking the main event loop.

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
├── SPEC.md               # This file
├── README.md             # Human documentation
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
- Factory signal handlers
- WorkerError class

---

_Note: This spec reflects the CURRENT piscina-based implementation._
