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

| Scenario | Use Thread Pool? | Why |
|----------|-----------------|-----|
| Fibonacci, prime sieve, hashing | ✅ Yes | CPU-bound, blocks event loop |
| Image/PDF processing | ✅ Yes | CPU-intensive transforms |
| Database queries | ❌ No | I/O-bound, needs `models` |
| Search indexing | ❌ No | Needs DI container |
| File upload/download | ❌ No | I/O-bound, needs FS engine |
| Email sending | ❌ No | I/O-bound, needs provider |

**Rule of thumb**: If the worker needs `container`, `models`, `search`, or `db`, it must stay as a direct function call.

## API Reference

### `worker.run(workerName, fnName, data, options)`

Run a function in a thread.

- **workerName** `string` — Registered worker name (e.g., `'math'`)
- **fnName** `string` — Export function name (e.g., `'fibonacci'`)
- **data** `any` — Serializable payload
- **options.timeout** `number` — Override task timeout (ms)
- **Returns** `Promise<any>` — Worker function return value

### `worker.registerWorker(name, absolutePath)`

Manually register a worker file path.

### `worker.discoverWorkers(baseDir)`

Scan a directory recursively for `*.worker.js` files that contain the `THREADED` marker and register them with:
- **Namespaced key** (relative path, e.g., `extensions/my_plugin/math`) — always unique
- **Short alias** (basename, e.g., `math`) — only when the basename is unique across all files

> Workers without `THREADED` in their compiled output are skipped (they're Tier 1 — direct import only).

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

Gracefully terminate all threads and reject queued tasks.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `XNAPIFY_WORKER_MIN_THREADS` | `1` | Always-warm threads |
| `XNAPIFY_WORKER_MAX_THREADS` | `cpus - 1` | Thread ceiling |
| `XNAPIFY_WORKER_IDLE_TIMEOUT` | `30000` | Idle termination (ms) |
| `XNAPIFY_WORKER_TASK_TIMEOUT` | `30000` | Per-task timeout (ms) |
| `XNAPIFY_WORKER_QUEUE_MAX` | `100` | Max queued tasks |

## Writing a Threadable Worker

```javascript
// my-task.worker.js

/** Marks this worker as eligible for thread pool execution. */
export const THREADED = true;

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
1. Export `THREADED = true`
2. All inputs/outputs must be JSON-serializable
3. No imports of DI-dependent modules (`container`, `models`, `search`)
4. Pure functions only — no side effects on shared state

## Troubleshooting

### `WORKER_NOT_FOUND`
The worker wasn't discovered. Check:
- Does the worker file `export const THREADED = true`?
- Was the `*.worker.js` file compiled by webpack?
- Is the file in `BUILD_DIR` or a subdirectory?
- Does the filename end with `.worker.js`?

### `WORKER_TIMEOUT`
The worker function took too long. Options:
- Increase `XNAPIFY_WORKER_TASK_TIMEOUT`
- Pass `{ timeout: 60000 }` as options to `run()`
- Optimize the worker function

### `QUEUE_FULL`
All threads are busy and the queue is full. Options:
- Increase `XNAPIFY_WORKER_MAX_THREADS`
- Increase `XNAPIFY_WORKER_QUEUE_MAX`
- Rate-limit incoming requests
