# API Guidelines

This document provides architectural guidelines and patterns for developing features in the `src/api` directory.

## Architecture Overview

The API is structured into **Engines** and **Modules**.

- **Engines** (`src/api/engines`): Core infrastructure components (e.g., Database, Email, Worker, Schedule). They provide capabilities involved in technical plumbing.
- **Modules** (`src/api/modules`): Business logic domains (e.g., Auth, User, Group). They consume engines to implement features.

## Integration Patterns

### Schedule + Worker + Queue

For recurring tasks that involve heavy processing, network requests, or long-running operations, you should **never** run logic directly in the Schedule callback. Instead, combine the Schedule Engine with the Worker Engine.

**The Pattern:**
`Schedule Engine (Trigger) -> Worker Pool (Queue) -> Worker Process (Execution)`

#### 1. Define the Worker

Create a worker file in your engine or module directory.
`src/api/engines/your-engine/workers/your-task.worker.js`

```javascript
import { createWorkerHandler } from 'src/api/engines/worker';

const myTaskLogic = async payload => {
  // Heavy processing here
  return { success: true };
};

export default createWorkerHandler(myTaskLogic, 'MY_TASK_TYPE');
```

#### 2. Create the Worker Pool

If one doesn't exist for your domain, create a pool.
`src/api/engines/your-engine/workers/index.js`

```javascript
import { createWorkerPool } from 'src/api/engines/worker';

const workersContext = require.context('.', false, /\.worker\.js$/);
const workerPool = createWorkerPool(workersContext, {
  engineName: 'MyDomain',
  maxWorkers: 2, // Controls concurrency
});

export default workerPool;
```

#### 3. Schedule the Task

Register the cron job to dispatch a job to the worker pool.
`src/api/engines/your-engine/index.js` (or in a module boot file)

```javascript
import schedule from 'src/api/engines/schedule';
import workerPool from './workers';

schedule.register('my-recurring-task', '0 0 * * *', async () => {
  // This callback is lightweight and only dispatches the job
  await workerPool.sendRequest('your-task', 'MY_TASK_TYPE', {
    timestamp: Date.now(),
  });
});
```

### Why this pattern?

1.  **Non-blocking**: The main process isn't blocked by heavy cron jobs.
2.  **Concurrency Control**: `maxWorkers` limits how many jobs run in parallel.
3.  **Queueing**: If all workers are busy, the `WorkerPool` automatically queues the request.
4.  **Reliability**: Worker crashes don't crash the main API server.
