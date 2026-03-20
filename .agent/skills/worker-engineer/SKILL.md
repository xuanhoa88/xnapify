---
name: worker-engineer
description: Build worker handlers and pools with Piscina for background processing, concurrency control, and error propagation.
---

# Worker Engineer Skill

This skill equips you to build non-blocking background tasks and worker pools for the `rapid-rsk` application using the Worker Engine (`@shared/api/engines/worker`).

## Core Concepts
The Worker Engine manages concurrency, error handling, and thread assignment for heavy, asynchronous, or scheduled node operations.

## Procedure: Defining a Worker Handler
1. **File Location:** Create a file named `[taskName].worker.js` inside the relevant module's `api/` directory.
2. **Implementation:**
   - Define an `async` function that takes `payload` and `context` (if any).
   - The function should return `{ success: true, ...results }` on success. Uncaught errors are properly passed to the caller natively.
   - Export the initialized handler as a named export matching the intended task type identifier: `export { taskHandler as TASK_TYPE_IDENTIFIER };`.

## Procedure: Defining a Worker Pool
Worker pools manage a specific group of workers.

1. **Instantiation Context:** A worker pool is normally instantiated inside a controller or service file (e.g., `src/apps/[module]/api/workerService.js`).
2. **Implementation:**
   - Import `createWorkerPool` from `@shared/api/engines/worker`.
   - Load the worker context dynamically: `const workersContext = require.context('.', false, /\.worker\.js$/);`
   - Initialize the pool:
     ```javascript
     export const workerPool = createWorkerPool('MyModuleEngine', workersContext, {
       maxWorkers: 2, // Concurrency limits
     });
     ```

## Procedure: Dispatching a Task
Any service or route controller can dispatch a payload to the worker pool.

1. Import the defined `workerPool`.
2. Dispatch using an async method: `await workerPool.sendRequest('unique-task-batch-1', 'TASK_TYPE_IDENTIFIER', payload, { throwOnError: true });`.
3. The identifier must precisely match the `'TASK_TYPE_IDENTIFIER'` exported from the handler.
4. With `{ throwOnError: true }`, wrap your dispatch in a try/catch block for robust error handling.

## Scheduling considerations
If you need a cron job, integrate your worker with the `Schedule Engine`:
```javascript
import schedule from '@shared/api/engines/schedule';
schedule.register('daily-cleanup', '0 0 * * *', async () => {
  await workerPool.sendRequest('cleanup-batch-1', 'CLEANUP_TASK', {});
});
```

*Note: Ensure robust error bounds on worker payloads. Heavy tasks should track progress explicitly.*

## Hybrid Pattern: Queue + Piscina

When a worker needs **both** `app` access (models, hooks, extension manager) **and** CPU offloading, use the hybrid pattern:

1. **Queue handlers** run on the main thread for stateful operations (DB writes, hook emissions, WebSocket notifications).
2. **Piscina workers** handle CPU-bound subtasks (hashing, compression, image processing) called from within queue handlers.

### When to Use
- Worker needs `container.resolve('models')`, `container.resolve('hook')`, or other `app` singletons → **Queue pattern**
- Worker does CPU-intensive computation → **Piscina worker**
- Worker needs **both** → **Hybrid** (queue orchestrates, Piscina computes)

### Reference Implementation
See `src/apps/extensions/api/` for the canonical example:
- `workers/checksum.worker.js` — Stateless Piscina worker for SHA-256 hashing
- `workers/index.js` — Worker pool with `computeChecksum()` / `verifyChecksum()` methods
- `services/extension.workers.js` — Queue handlers that call `workerPool.computeChecksum()` for CPU work while using `app` for DB/hooks

```javascript
// Queue handler calling Piscina worker for CPU-bound subtask
import workerPool from '../workers';

async function handleInstallJob(app, job) {
  const { pluginDir, pluginId } = job.data;

  // I/O-bound: runs in main process (needs app)
  await installPluginDependencies(pluginDir);

  // CPU-bound: offloaded to Piscina thread
  const checksum = await workerPool.computeChecksum(pluginDir);

  // Stateful: needs app for DB access
  const { Plugin } = container.resolve('models');
  await Plugin.update({ checksum }, { where: { id: pluginId } });
}

export function registerWorkers(container) {
  const queue = container.resolve('queue');
  const channel = queue('my-channel');
  channel.on('install', job => handleInstallJob(app, job));
}
```

