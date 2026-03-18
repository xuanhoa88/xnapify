# Worker Engine

Piscina-based thread pool for CPU-intensive background tasks with hybrid execution (same-process first, thread fallback), dynamic worker discovery via Webpack `require.context`, and automatic scaling.

## Quick Start

```javascript
import { createWorkerPool } from '@shared/api/engines/worker';

const workersContext = require.context('.', false, /\.worker\.js$/);
const workerPool = createWorkerPool('MyEngine', workersContext, {
  maxWorkers: 2,
});

const result = await workerPool.sendRequest('taskName', 'HANDLER_EXPORT', payload);
```

## API

### `createWorkerPool(engineName, workersContext, options?)`

Creates a worker pool instance.

| Param | Type | Description |
|---|---|---|
| `engineName` | `string` | Engine name for logging |
| `workersContext` | `require.context` | Webpack context for `*.worker.js` files |
| `options.maxWorkers` | `number` | Max threads (default: `min(cpus, 4)`) |
| `options.workerTimeout` | `number` | Timeout per task in ms (default: `60000`) |
| `options.forceFork` | `boolean` | Skip same-process execution (default: `false`) |
| `options.ErrorHandler` | `class` | Custom error class (default: `WorkerError`) |

### WorkerPool Instance

| Method | Description |
|---|---|
| `sendRequest(workerType, messageType, data, options?)` | Execute a worker task |
| `sendRequestToThread(workerType, messageType, data)` | Force Piscina thread execution |
| `unregisterWorker(workerType)` | Remove a worker type |
| `getStats()` | Pool statistics (utilization, completed tasks) |
| `cleanup()` | Destroy pool and threads |

### Hybrid Execution

1. **Same-process first** — imports the worker module and calls the export directly (no IPC overhead).
2. **Piscina thread fallback** — if same-process fails or `forceFork: true`, offloads to a background thread.

### Worker File Convention

```javascript
// myTask.worker.js
export async function COMPUTE_HASH(data) {
  return { hash: sha256(data.content) };
}
```

- File naming: `{name}.worker.js`
- Named exports match the `messageType` parameter in `sendRequest`.

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
