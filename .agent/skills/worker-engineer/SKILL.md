---
name: Worker Engineer
description: specialized skill for developing Worker Handlers and Pools for background processing tasks
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
