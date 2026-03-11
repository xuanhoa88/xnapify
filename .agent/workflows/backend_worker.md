---
description: Create and dispatch a background worker process
---

To process intensive or scheduled background tasks in the application, the system handles heavy processing through the **Worker Engine** via the `@shared/api/worker` module.

When creating a background worker, follow this multi-step implementation plan.

### 1. Define the Worker Handler

Create a worker definition file inside the relevant module's `api/` directory (e.g., `src/apps/[module]/api/taskName.worker.js`).

```javascript
import { createWorkerHandler } from '@shared/api/engines/worker';

/**
 * Task handler that is executed by the Worker Engine
 * @param {Object} payload The data required to perform the task
 * @param {Object} context Metadata and additional context from the engine
 */
const taskHandler = async (payload, context) => {
  try {
    // 1. Process data from the payload (heavy computation, external requests, batch DB queries)
    const { userId, dataFile } = payload;
    
    // 2. Perform intensive task...
    
    // 3. Return results or indicate success to the Worker Engine
    return { success: true, processedItemCount: 10 };
  } catch (err) {
    // Propagate the error so the engine logs the failed job and handles retries
    throw err;
  }
};

// Export the constructed handler using the desired task type identifier
export default createWorkerHandler(taskHandler, 'TASK_TYPE_IDENTIFIER');
```

### 2. Create the Worker Pool Interface

Next, initialize the worker pool within your module's service or controller (e.g., `src/apps/[module]/api/workerService.js`), linking it to the worker handler files.

```javascript
import { createWorkerPool } from '@shared/api/engines/worker';

// Load all `.worker.js` files dynamically from the current directory
const workersContext = require.context('.', false, /\.worker\.js$/);

// Create the pool assigned to an Engine namespace
export const workerPool = createWorkerPool(workersContext, {
  engineName: 'MyModuleEngine',
  maxWorkers: 2, // Define thread/pool concurrency limits appropriate for the task
});
```

### 3. Dispatch the Job

You can dispatch jobs to this worker queue from any controller, service, or script by calling `sendRequest` on the pool you created.

```javascript
import { workerPool } from './workerService';

export async function submitDataProcessing(req, res) {
  const payload = {
    userId: req.user.id,
    dataFile: req.file.path,
  };

  // Dispatch the job async: The task logic in step 1 will execute
  // The identifier 'TASK_TYPE_IDENTIFIER' must match the one from Step 1.
  await workerPool.sendRequest('unique-task-batch-1', 'TASK_TYPE_IDENTIFIER', payload);
  
  res.json({ message: 'Task queued successfully' });
}
```

### Considerations

- **Scalability**: The system executes this handler asynchronously without blocking the main event thread of your node server.
- **Failures**: Errors thrown inside `taskHandler` are typically logged. You can enhance reliability by using explicit error queues or setting retry configurations if defined by the Worker Engine `@shared` framework you implement.
- **Cron Jobs**: To execute a worker periodically, use `@shared/api/schedule` to trigger the `sendRequest` command on a set schedule (`schedule.register(...)`).
