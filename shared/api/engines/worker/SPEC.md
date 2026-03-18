# Worker Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Worker Engine at `shared/api/engines/worker`.

---

## Objective

Provide a Piscina-based thread pool with hybrid execution strategy (same-process + thread), dynamic worker discovery, and automatic scaling for CPU-intensive tasks.

## 1. Architecture

```
shared/api/engines/worker/
├── index.js              # Re-exports createWorkerPool, WorkerError
├── createWorkerPool.js   # WorkerPool class + factory function
└── errors.js             # WorkerError class
```

## 2. `createWorkerPool` (`createWorkerPool.js`)

### Configuration

- `DEFAULT_WORKER_CONFIG`: `maxWorkers` = `min(cpus, 4)`, `workerTimeout` = 60s, `workerCreationTimeout` = 10s, `forceFork` = false.

### Piscina Lazy Loading

- `isPiscinaSupported()` — checks Node.js ≥ 16.14.0.
- `loadPiscina()` — uses `__non_webpack_require__` (or `require`) to load at runtime, hidden from Webpack static analysis.

### Worker Discovery

- `createWebpackContextAdapter(workersContext)` — wraps `require.context` for portable file/module access.
- `getAvailableWorkers()` — extracts worker names from `*.worker.js` pattern.
- Workers are cached in `workerModuleCache` (`Map`) for same-process execution.

### WorkerPool Class

- `sendRequest(workerType, messageType, data, options)`:
  1. Try same-process: `tryImportWorkerModule(workerType)`, call `module[messageType](data)`.
  2. Fallback to thread: `sendRequestToThread` via Piscina `pool.run()`.
  3. Returns `{ success, result }` or `{ success: false, error }` based on `throwOnError`.

- `sendRequestToThread(workerType, messageType, data)`:
  - Resolves worker file path via `adapter.resolve()`.
  - Uses `AbortController` for timeout management.
  - Runs `pool.run(data, { filename, name: messageType, signal })`.

- `unregisterWorker(workerType)` — removes from known workers and module cache.
- `getStats()` — returns `{ totalWorkers, utilization, completedTasks, runTimeInfo }`.
- `cleanup()` — destroys Piscina pool.

### Pool Lazy Initialization

The Piscina pool is created lazily on first `pool` access (getter property). Returns `null` if Piscina can't be loaded.

## 3. WorkerError (`errors.js`)

```javascript
class WorkerError extends Error {
  constructor(message, code, statusCode)
}
```

Codes: `UNSUPPORTED_NODE_VERSION`, `INITIALIZATION_ERROR`, `WORKER_REQUEST_TIMEOUT`.

## 4. No Default Singleton

Unlike other engines, the worker engine exports only the `createWorkerPool` factory. Each module creates its own pool instance with its own `require.context`.

---

*Note: This spec reflects the CURRENT implementation of the worker engine.*
