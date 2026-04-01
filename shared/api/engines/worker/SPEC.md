# Worker Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Worker Engine at `shared/api/engines/worker`.
> This engine provides Piscina-backed worker thread pools with hybrid execution (same-process + thread fallback) for CPU-intensive tasks.

---

## Objective

Provide a factory-based thread pool that each module instantiates independently, with dynamic worker discovery via Webpack `require.context`, hybrid execution strategy, and automatic timeout management.

## 1. Architecture

```
shared/api/engines/worker/
├── index.js              # Re-exports createWorkerPool, WorkerError
├── createWorkerPool.js   # WorkerPool class + factory function
└── errors.js             # WorkerError class
```

### Dependency Graph

```
index.js
├── createWorkerPool.js
│   ├── @shared/utils/contextAdapter
│   ├── piscina (runtime-loaded, not bundled)
│   └── errors.js
└── errors.js
```

## 2. Error Class: `WorkerError`

**File:** `errors.js`

Extends `Error` with structured properties for consistent error handling, following the pattern shared by `ScheduleError`.

| Property | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `'WorkerError'` | Error name for `instanceof` checks |
| `code` | `string` | `'WORKER_ERROR'` | Machine-readable error code |
| `statusCode` | `number` | `500` | HTTP-compatible status code |
| `timestamp` | `string` | ISO 8601 | When the error was created |

Uses `Error.captureStackTrace` for clean stack traces.

### Error Codes

| Code | Thrown By | Meaning |
|---|---|---|
| `UNSUPPORTED_NODE_VERSION` | `isPiscinaSupported()`, `sendRequestToThread()` | Node.js < 16.14.0, Piscina unavailable |
| `INITIALIZATION_ERROR` | `loadPiscina()` | `require('piscina')` failed at runtime |
| `WORKER_REQUEST_TIMEOUT` | `sendRequestToThread()` | Task exceeded `workerTimeout` (AbortController fired) |

## 3. Piscina Loading

**File:** `createWorkerPool.js` (module-level helpers)

- `isPiscinaSupported()` — checks `process.versions.node >= 16.14.0`.
- `loadPiscina()` — uses `createNativeRequire(__filename)` to load Piscina at runtime, hidden from Webpack static analysis. Result is cached in module-level `Piscina` variable.
- Piscina is **never bundled** — always resolved at runtime.

## 4. Worker Discovery

**File:** `createWorkerPool.js` (closure-level helpers)

- `createWebpackContextAdapter(workersContext)` — wraps Webpack's `require.context` into a portable `{ files(), load(key), resolve(key) }` adapter (from `@shared/utils/contextAdapter`).
- `getAvailableWorkers()` — extracts worker names from `*.worker.[cm]?[jt]s` pattern via `adapter.files()`.
- `tryImportWorkerModule(workerName)` — loads and caches worker modules in a `Map` (`workerModuleCache`) for same-process execution. Returns `null` on failure (triggers thread fallback).
- `getWorkerPath(workerName)` — resolves absolute filesystem path via `adapter.resolve()` for Piscina thread execution.

## 5. Factory Function: `createWorkerPool(engineName, workersContext, options?)`

**File:** `createWorkerPool.js`

Creates and returns a bound `WorkerPool` instance. Each module creates its own pool — there is **no shared singleton**.

### Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `engineName` | `string` | *required* | Name used in log messages (e.g. `'Search'`, `'🔌 Extension'`) |
| `workersContext` | `require.context` | *required* | Webpack context matching `*.worker.js` files |
| `options.maxWorkers` | `number` | `min(os.cpus().length, 4)` | Maximum Piscina threads |
| `options.workerTimeout` | `number` | `60000` | Per-task timeout in ms |
| `options.forceFork` | `boolean` | `false` | Skip same-process execution globally |
| `options.ErrorHandler` | `class` | `WorkerError` | Custom error class for worker-specific errors |

### Return Value

Returns a `WorkerPool` instance with `sendRequest` pre-bound to the instance (safe for destructured use).

### Static Property

`createWorkerPool.options` — exposes `DEFAULT_WORKER_CONFIG` (`maxWorkers`, `workerTimeout`, `workerCreationTimeout`, `forceFork`).

## 6. WorkerPool Class

**File:** `createWorkerPool.js` (inner class within factory closure)

### Constructor

- Reads `maxWorkers`, `workerTimeout`, `forceFork`, `ErrorHandler` from closure and options.
- Calls `getAvailableWorkers()` — stores discovered worker names in `this.knownWorkers`.
- Logs discovered workers in non-production environments.
- `this.piscinaPoolInstance` initialized as `null` (lazy).

### Lazy Pool Initialization (`get pool`)

A getter property that creates the Piscina pool on first access:
- Calls `loadPiscina()`, creates `new Piscina({ maxThreads, workerCreationTimeout })`.
- Returns `null` if Piscina cannot be loaded (error is swallowed; `sendRequestToThread` will throw).

### Methods

#### `sendRequest(workerType, messageType, data, requestOptions?)`

Primary dispatch method with hybrid execution strategy.

| Param | Type | Description |
|---|---|---|
| `workerType` | `string` | Worker filename stem (e.g. `'checksum'` for `checksum.worker.js`) |
| `messageType` | `string` | Named export to invoke (e.g. `'COMPUTE_CHECKSUM'`) |
| `data` | `any` | Payload passed to the worker function |
| `requestOptions.throwOnError` | `boolean` | Throw on failure instead of returning error object |
| `requestOptions.forceFork` | `boolean` | Per-call override to skip same-process execution |

**`throwOnError` resolution:** Checks `requestOptions.throwOnError` first; falls back to `data.options.throwOnError` if the request option is `undefined`.

**Execution flow:**
1. If `forceFork` is not set (neither global nor per-call): try same-process execution via `tryImportWorkerModule()` → call `module[messageType](data)`.
2. If same-process fails (module not found, export missing, or throws): falls back to thread.
   - **Exception:** If same-process throws AND `throwOnError` is `true` AND `forceFork` is not set → re-throws immediately without fallback.
3. Thread execution via `sendRequestToThread()`.
4. Returns `{ success: true, result }` on success.
5. On thread failure: throws if `throwOnError`, otherwise returns `{ success: false, error: { message, code, statusCode, stack } }`.

#### `sendRequestToThread(workerType, messageType, data)`

Forces Piscina thread execution. Called internally by `sendRequest` or directly by consumers.

- Validates `workerType` is in `this.knownWorkers` — throws `ErrorHandler` if not.
- Resolves worker file path via `getWorkerPath()`.
- Creates `AbortController` with `setTimeout` for `workerTimeout`.
- Calls `pool.run(data, { filename, name: messageType, signal })`.
- On `AbortError` → throws `WorkerError` with code `WORKER_REQUEST_TIMEOUT`.
- Cleans up timeout in `finally` block.

#### `unregisterWorker(workerType) → boolean`

Removes from `knownWorkers` and clears `workerModuleCache`. Returns `false` if not found. Logs in non-production.

#### `getStats() → StatsObject`

Returns pool statistics. If no Piscina pool exists yet, returns zeroed stats.

```javascript
{
  totalWorkers: number,  // pool.threads.length
  utilization: number,   // pool.utilization
  completedTasks: number, // pool.completed
  runTimeInfo: object,   // pool.runTime (idle, running, waiting)
}
```

#### `cleanup() → Promise<void>`

Destroys the Piscina pool and sets `piscinaPoolInstance` to `null`. Logs cleanup. No-op if pool was never created.

## 7. No Default Singleton

Unlike other engines (`schedule`, `hook`), the worker engine exports only the `createWorkerPool` factory. Each module creates its own pool instance scoped to its own `require.context`. The engine is registered on the DI container as `container.resolve('worker')` which exposes the `{ createWorkerPool, WorkerError }` exports.

## 8. Usage Patterns in the Codebase

### Direct Import (extension module)

```javascript
import { createWorkerPool } from '@shared/api/engines/worker';
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);
const workerPool = createWorkerPool('🔌 Extension', workersContext, { maxWorkers: 2 });
```

### DI-based (search, activities modules)

```javascript
const { createWorkerPool } = container.resolve('worker');
const workerPool = createWorkerPool('Search', workersContext, { maxWorkers: 1 });
```

### Convenience Method Pattern

Modules extend the pool instance with domain-specific methods:

```javascript
workerPool.computeChecksum = async function(dir, options) {
  const { result } = await this.sendRequest('checksum', 'COMPUTE_CHECKSUM',
    { dir, options }, { throwOnError: true });
  return result;
};
```

### Per-Call `forceFork` Override

```javascript
await workerPool.sendRequest('flexsearch', 'INDEX_USER',
  { search, user }, { forceFork: true });
```

## 9. Integration Points

- **Module `boot({ container })`**: Access via `container.resolve('worker')` to get the factory, then create module-specific pools.
- **Schedule Engine**: Cron handlers can dispatch heavy work to worker pools.
- **Extension lifecycle**: Extensions can import `createWorkerPool` directly for isolated pools.
- **Hybrid pattern**: Queue handlers (main thread, `app` access) call `workerPool.sendRequest()` for CPU-bound subtasks.

---

*Note: This spec reflects the CURRENT implementation of the worker engine.*
