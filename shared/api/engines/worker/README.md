# Worker Engine

Piscina-based thread pool for CPU-intensive background tasks with hybrid execution (same-process first, thread fallback), dynamic worker discovery via Webpack `require.context`, and automatic scaling.

## Quick Start

```javascript
import { createWorkerPool } from '@shared/api/engines/worker';

// Discover *.worker.js files in the current directory
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);

const workerPool = createWorkerPool('MyEngine', workersContext, {
  maxWorkers: 2,
  workerTimeout: 60_000,
});

// Dispatch: workerType matches filename stem, messageType matches named export
const { success, result } = await workerPool.sendRequest(
  'myTask',        // → myTask.worker.js
  'PROCESS_DATA',  // → export async function PROCESS_DATA(data)
  { input: '...' },
  { throwOnError: true },
);
```

## API

### `createWorkerPool(engineName, workersContext, options?)`

Creates a worker pool instance. Each module creates its own pool — there is no shared singleton.

| Param | Type | Default | Description |
|---|---|---|---|
| `engineName` | `string` | *required* | Name for log messages |
| `workersContext` | `require.context` | *required* | Webpack context for `*.worker.js` files |
| `options.maxWorkers` | `number` | `min(cpus, 4)` | Maximum Piscina threads |
| `options.workerTimeout` | `number` | `60000` | Per-task timeout in ms |
| `options.forceFork` | `boolean` | `false` | Skip same-process execution globally |
| `options.ErrorHandler` | `class` | `WorkerError` | Custom error class |

### WorkerPool Instance

| Method | Description |
|---|---|
| `sendRequest(workerType, messageType, data, options?)` | Hybrid execute: same-process first, thread fallback |
| `sendRequestToThread(workerType, messageType, data)` | Force Piscina thread execution |
| `unregisterWorker(workerType)` | Remove a worker type from the pool |
| `getStats()` | Pool statistics (threads, utilization, completed tasks) |
| `cleanup()` | Destroy pool and release threads |

### `sendRequest` Options

| Option | Type | Description |
|---|---|---|
| `throwOnError` | `boolean` | Throw on failure instead of returning `{ success: false, error }` |
| `forceFork` | `boolean` | Per-call override to skip same-process and force thread execution |

### Hybrid Execution Strategy

1. **Same-process first** — imports the worker module and calls the named export directly (no IPC overhead, no serialization cost).
2. **Thread fallback** — if same-process fails, module not found, or `forceFork` is set, offloads to a Piscina background thread with timeout management.

### Worker File Convention

```javascript
// myTask.worker.js

export async function PROCESS_DATA(data) {
  // data is the payload from sendRequest
  return { processed: transform(data.input) };
}

export async function ANOTHER_TASK(data) {
  return { result: compute(data) };
}
```

- **File naming:** `{name}.worker.js` — the `name` part becomes the `workerType` parameter.
- **Named exports** match the `messageType` parameter in `sendRequest`.
- Workers must be **stateless** — no access to `app`, models, or hooks.

### Convenience Method Pattern

Modules typically extend the pool with domain-specific methods:

```javascript
workerPool.computeChecksum = async function (dir, options = {}) {
  const { result } = await this.sendRequest(
    'checksum', 'COMPUTE_CHECKSUM',
    { dir, options }, { throwOnError: true },
  );
  return result;
};
```

### Access via DI Container

```javascript
// In module init(container):
const { createWorkerPool } = container.resolve('worker');
const pool = createWorkerPool('MyModule', workersContext, { maxWorkers: 1 });
```

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
