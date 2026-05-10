# Queue Engine

Channel-based pub/sub for background job processing with priority, delays, retry with exponential backoff, concurrency control, and pluggable adapters.

## Quick Start

```javascript
const queue = container.resolve('queue');

// Create a channel and register handler (consumer)
const notifications = queue('notifications', { concurrency: 5 });
notifications.on('email', async job => {
  await sendEmail(job.data);
});

// Emit a job (producer)
queue.channel('notifications').emit('email', {
  to: 'user@example.com',
  subject: 'Welcome',
});
```

## API

### Factory

The factory is **callable** — `queue('name')` creates or returns a channel. `queue.channel('name')` is lookup-only.

| Method                                   | Returns            | Description                                             |
| ---------------------------------------- | ------------------ | ------------------------------------------------------- |
| `queue('name', options?)`                | `Channel\|null`    | Create or get a channel                                 |
| `queue.channel('name')`                  | `Channel\|null`    | Get existing channel only (returns `null` if not found) |
| `queue.has('name')`                      | `boolean`          | Check if channel exists                                 |
| `queue.getChannelNames()`                | `string[]`         | List all channel names                                  |
| `queue.getStats()`                       | `object`           | Stats for all channels                                  |
| `queue.remove('name')`                   | `Promise<boolean>` | Close and remove a channel                              |
| `queue.cleanup()`                        | `Promise<void>`    | Close all channels (auto on process exit)               |
| `queue.registerAdapter('type', Adapter)` | `boolean`          | Register custom adapter (won't override existing)       |

### Channel

| Method                         | Returns         | Description                         |
| ------------------------------ | --------------- | ----------------------------------- |
| `on(event, handler)`           | `this`          | Register job handler (chainable)    |
| `off(event)`                   | `this`          | Remove handler (chainable)          |
| `emit(event, data?, options?)` | `Job\|null`     | Publish a job                       |
| `emitBulk(events)`             | `Job[]`         | Publish multiple jobs               |
| `hasHandler(event)`            | `boolean`       | Check if handler exists             |
| `getHandlerCount()`            | `number`        | Number of registered handlers       |
| `getStats()`                   | `object`        | Channel statistics                  |
| `close()`                      | `Promise<void>` | Close channel and release resources |

### Job Options

Options passed to `emit(event, data, options)`:

| Option             | Type      | Default | Description                      |
| ------------------ | --------- | ------- | -------------------------------- |
| `priority`         | `number`  | `0`     | Higher = processed first         |
| `delay`            | `number`  | `0`     | Delay in ms before processing    |
| `attempts`         | `number`  | `3`     | Max retry attempts               |
| `backoff`          | `number`  | `1000`  | Base backoff in ms (exponential) |
| `removeOnComplete` | `boolean` | `true`  | Auto-remove on success           |
| `removeOnFail`     | `boolean` | `false` | Auto-remove on final failure     |

### Job Object

The handler receives a job context with:

```javascript
notifications.on('email', async job => {
  job.id; // UUID
  job.name; // Event name
  job.data; // Your payload
  job.attempts; // Current attempt number

  // Report progress (0-100)
  job.updateProgress(50);
});
```

### JOB_STATUS

```javascript
import { JOB_STATUS } from '@shared/api/engines/queue';
// { PENDING, ACTIVE, COMPLETED, FAILED, DELAYED }
```

### Error Classes

```javascript
import {
  QueueError,
  JobNotFoundError,
  JobProcessingError,
  QueueConnectionError,
} from '@shared/api/engines/queue/errors';
```

## Retry Behavior

Failed jobs are retried with exponential backoff: `backoff × 2^(attempt-1)`.

```
Attempt 1 fails → wait 1s  → retry
Attempt 2 fails → wait 2s  → retry
Attempt 3 fails → FAILED (max attempts reached)
```

## Custom Adapters

```javascript
class RedisQueue {
  constructor(options) {
    /* { name, concurrency, ... } */
  }
  add(event, data, options) {
    /* → Job */
  }
  process(handler) {
    /* handler = async (job) => result */
  }
  close() {
    /* → Promise */
  }
  getStats() {
    /* → object */
  }
}

queue.registerAdapter('redis', RedisQueue);
const channel = queue('jobs', { type: 'redis' });
```

## Isolated Instances

For testing or extensions with independent lifecycle:

```javascript
import { createFactory } from '@shared/api/engines/queue';

const testQueue = createFactory({ type: 'memory', concurrency: 2 });
const channel = testQueue('test-channel');
channel.on('event', async job => {
  /* ... */
});
```

## Integration with Schedule Engine

```javascript
const notifications = queue('notifications', { concurrency: 10 });
notifications.on('email', async job => {
  await sendEmail(job.data);
});

schedule.register('daily-digest', '0 9 * * *', () => {
  queue.channel('notifications').emit('email', {
    template: 'digest',
    to: 'users@example.com',
  });
});
```

---

# Queue Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Queue Engine at `shared/api/engines/queue`.
> This engine provides channel-based pub/sub job queuing with priority, delays, retry logic, concurrency control, and pluggable adapters.

---

## Objective

Provide a channel-based job queue for background processing where producers `emit` events and consumers `on` them, with pluggable storage adapters, job priority/delay/retry semantics, and per-channel concurrency control.

## 1. Architecture

```text
shared/api/engines/queue/
├── index.js              # Default singleton, re-exports JOB_STATUS
├── factory.js            # buildFactory() + createFactory()
├── channel.js            # Channel class (pub/sub wrapper)
├── errors.js             # QueueError + subclasses
├── adapters/
│   ├── memory.js         # In-memory adapter (default)
│   └── file.js           # Persistent file-based adapter
├── utils/
│   ├── constants.js      # JOB_STATUS enum
│   ├── createJob.js      # Job creation factory utility
│   ├── eventMixin.js     # Shared EventEmitter mixin
│   └── findProcessor.js  # Job matching router
├── __mocks__/
│   └── uuid.js           # Jest mock for uuid
├── queue.test.js         # Fast unit tests
├── fileQueue.test.js     # Persistent storage tests
└── queue.perf.test.js    # Throughput benchmark suites
```

### Dependency Graph

```text
index.js
├── factory.js
│   ├── channel.js
│   ├── adapters/memory.js
│   └── adapters/file.js
│       ├── (both adapters share)
│       ├── uuid (external)
│       ├── errors.js
│       ├── utils/constants.js
│       ├── utils/createJob.js
│       ├── utils/eventMixin.js
│       └── utils/findProcessor.js
└── utils/constants.js
```

## 2. Error Classes

**File:** `errors.js`

Four error classes forming an inheritance hierarchy:

| Class                  | Code                       | Status | Extra Props              | Description                |
| ---------------------- | -------------------------- | ------ | ------------------------ | -------------------------- |
| `QueueError`           | `'QUEUE_ERROR'`            | `500`  | —                        | Base error                 |
| `JobNotFoundError`     | `'JOB_NOT_FOUND'`          | `404`  | `jobId`                  | `getJob()` with unknown ID |
| `JobProcessingError`   | `'JOB_PROCESSING_ERROR'`   | `500`  | `jobId`, `originalError` | Handler failed             |
| `QueueConnectionError` | `'QUEUE_CONNECTION_ERROR'` | `503`  | —                        | Adapter connection failure |

All error classes include `statusCode`, `code`, `timestamp`, and `Error.captureStackTrace`.

## 3. Constants: `JOB_STATUS`

**File:** `utils/constants.js`

```javascript
{
  (PENDING, ACTIVE, COMPLETED, FAILED, DELAYED);
}
```

Frozen enum. Exported by `index.js` as a named export.

## 4. Factory (`factory.js`)

### Internal: `buildFactory(channelsMap, adaptersMap, baseOptions)`

Private function that constructs a callable factory function with the following pattern:

- **Callable:** `factory(name, options?)` creates or returns an existing `Channel`.
- Channel names are trimmed strings. Invalid names return `null` with `console.error`.
- New channels are created by instantiating the adapter class from `adaptersMap` (looked up by `options.type`), wrapping it in a `Channel`, and storing in `channelsMap`.
- Returns `null` (not throws) on all error paths.

### Methods on the factory function

| Method                                   | Signature                           | Behavior                                                                 |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `factory(name, options?)`                | `(string, object?) → Channel\|null` | Create or get channel. Merges `baseOptions` with `options`.              |
| `factory.channel(name)`                  | `(string) → Channel\|null`          | Get existing channel only. Returns `null` if not found.                  |
| `factory.has(name)`                      | `(string) → boolean`                | Check if channel exists.                                                 |
| `factory.getChannelNames()`              | `() → string[]`                     | All channel names.                                                       |
| `factory.getStats()`                     | `() → object`                       | Calls `channel.getStats()` for each channel. Catches errors per-channel. |
| `factory.remove(name)`                   | `(string) → Promise<boolean>`       | Calls `channel.close()`, deletes from map. Ignores close errors.         |
| `factory.cleanup()`                      | `() → Promise<void>`                | Closes all channels, clears map. Ignores per-channel close errors.       |
| `factory.registerAdapter(type, Adapter)` | `(string, Function) → boolean`      | Register custom adapter. Won't override existing adapter types.          |

### `createFactory(options?)`

Public export. Calls `buildFactory` with:

- Fresh `Map` for channels
- Fresh `Map` with `'memory' → MemoryQueue` pre-registered
- Merged `DEFAULT_OPTIONS` (`{ type: 'memory', concurrency: 1 }`) with caller options
- Registers cleanup handler with the centralized shutdown registry (`shared/api/shutdown.js`) for coordinated graceful shutdown

### Key difference from `factory(name)` vs `factory.channel(name)`

- `factory(name)` — **creates** channel if it doesn't exist (consumer-side).
- `factory.channel(name)` — **lookup only**, returns `null` if not found (producer-side).

## 5. Channel Class (`channel.js`)

Pub/sub wrapper around a queue adapter.

### Constructor

- `name` (string, defaults to `'default'`)
- `queue` — adapter instance
- `this.handlers` — `Map<eventName, handler>` (one handler per event)
- `this.isProcessing` — tracks whether `startProcessing()` has been called

### Methods

| Method                         | Signature                         | Returns            | Behavior                                                                                                                  |
| ------------------------------ | --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `on(event, handler)`           | `(string, Function)`              | `this` (chainable) | Validates inputs (logs error on failure, returns `this`). Stores handler. Calls `startProcessing()` on first `on()` call. |
| `off(event)`                   | `(string)`                        | `this` (chainable) | Removes handler by event name.                                                                                            |
| `emit(event, data?, options?)` | `(string, object?, object?)`      | `Job\|null`        | Delegates to `queue.add(event, data, options)`. Returns `null` on failure.                                                |
| `emitBulk(events)`             | `(Array<{event, data, options}>)` | `Job[]`            | Maps over events calling `emit()`. Filters out nulls.                                                                     |
| `hasHandler(event)`            | `(string)`                        | `boolean`          | Check if handler registered.                                                                                              |
| `getHandlerCount()`            | `()`                              | `number`           | `handlers.size`.                                                                                                          |
| `getStats()`                   | `()`                              | `object`           | Returns `{ name, handlers, handlerCount, isProcessing, queue }`.                                                          |
| `close()`                      | `()`                              | `Promise<void>`    | Clears handlers, sets `isProcessing = false`, calls `queue.close()`.                                                      |

### `startProcessing()` (private)

Called automatically on the first `on()` registration. Registers a **wildcard processor** with the adapter via `queue.process(async job => ...)`:

- Looks up handler by `job.name` from `this.handlers`.
- If no handler found → returns `{ skipped: true }`.
- If handler throws → logs error and **re-throws** (allowing adapter retry logic to trigger).

## 6. Memory Queue Adapter (`adapters/memory.js`)

In-memory job queue for development and single-instance deployments. Jobs are lost on restart.

### Constructor Options

| Option                               | Type      | Default     | Description                |
| ------------------------------------ | --------- | ----------- | -------------------------- |
| `name`                               | `string`  | `'default'` | Queue name                 |
| `concurrency`                        | `number`  | `1`         | Max parallel jobs          |
| `defaultJobOptions.attempts`         | `number`  | `3`         | Max retry attempts         |
| `defaultJobOptions.backoff`          | `number`  | `1000`      | Base backoff in ms         |
| `defaultJobOptions.delay`            | `number`  | `0`         | Delay before processing    |
| `defaultJobOptions.priority`         | `number`  | `0`         | Higher = processed first   |
| `defaultJobOptions.removeOnComplete` | `boolean` | `true`      | Auto-remove completed jobs |
| `defaultJobOptions.removeOnFail`     | `boolean` | `false`     | Auto-remove failed jobs    |

### Job Object Structure

```javascript
{
  id: string,            // UUID v4
  name: string,          // Event name
  data: object,          // Payload
  queue: string,         // Queue name
  status: JOB_STATUS,    // Current status
  priority: number,
  attempts: number,      // Current attempt count
  maxAttempts: number,
  backoff: number,       // Base backoff ms
  delay: number,
  removeOnComplete: boolean,
  removeOnFail: boolean,
  progress: number,      // 0-100
  result: any,           // Set on completion
  error: object|null,    // { message, stack }
  createdAt: number,     // Date.now()
  processedAt: number|null,
  completedAt: number|null,
  failedAt: number|null,
  scheduledFor: number|null,
}
```

### Job Lifecycle

```
PENDING → ACTIVE → COMPLETED (removed if removeOnComplete)
                 → FAILED (after maxAttempts exhausted)
                 → DELAYED → PENDING (retry with exponential backoff)

DELAYED → PENDING (after delay timer fires)
```

### Processing Logic (`processNext()`)

1. Checks `isPaused` and `activeJobs < concurrency`.
2. Sorts pending jobs by priority (descending), then `createdAt` (ascending, FIFO).
3. Finds a matching processor (specific name first, then wildcard `'*'`).
4. On success: sets `COMPLETED`, emits `'completed'` event, optionally removes job.
5. On failure with retries remaining: sets `DELAYED` with exponential backoff (`backoff * 2^(attempts-1)`), schedules `setTimeout` to re-pend.
6. On failure at max attempts: sets `FAILED`, emits `'failed'` event, optionally removes job.
7. Always decrements `activeJobs` and calls `processNext()` recursively.

All `setTimeout` timer IDs are tracked in `this.timers` (a `Set`) and cleared on `close()` to prevent resource leaks.

### Adapter Methods

| Method                                             | Description                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `add(name, data, options)`                         | Create and enqueue a job                                                           |
| `addBulk(jobs)`                                    | Batch add                                                                          |
| `process(name, processor)` or `process(processor)` | Register processor (named or wildcard `'*'`)                                       |
| `getJob(jobId)`                                    | Get job by ID (throws `JobNotFoundError`)                                          |
| `getJobsByStatus(status)`                          | Filter jobs by status                                                              |
| `getJobs()`                                        | All jobs                                                                           |
| `removeJob(jobId)`                                 | Remove by ID                                                                       |
| `retryJob(jobId)`                                  | Retry a failed job (resets attempts, throws `JobProcessingError` if not failed)    |
| `pause()` / `resume()`                             | Pause/resume processing                                                            |
| `isPausedState()`                                  | Check pause state                                                                  |
| `empty()`                                          | Remove all pending jobs                                                            |
| `clean(status?, grace?)`                           | Remove completed/failed jobs older than grace period                               |
| `close()`                                          | Pause, clear processors and jobs                                                   |
| `getStats()`                                       | Returns `{ name, concurrency, isPaused, activeJobs, counts: {...}, stats: {...} }` |
| `on(event, handler)` / `off(event, handler)`       | Lifecycle event listeners                                                          |

### Adapter Events

| Event       | Args              | When                                           |
| ----------- | ----------------- | ---------------------------------------------- |
| `active`    | `(job)`           | Job starts processing                          |
| `completed` | `(job, result)`   | Job completed successfully                     |
| `failed`    | `(job, error)`    | Job exhausted all retries                      |
| `progress`  | `(job, progress)` | `job.updateProgress(n)` called                 |
| `stalled`   | —                 | Registered but never emitted by memory adapter |

## 7. Adapter Interface Contract

Custom adapters must implement:

```javascript
class CustomAdapter {
  constructor(options) {} // { name, concurrency, ... }
  add(eventName, data, options) {} // → Job object
  process(handler) {} // handler = async (job) => result
  close() {} // → Promise<void>
  getStats() {} // → object (optional, used by Channel.getStats)
}
```

## 8. Default Singleton

**File:** `index.js`

### Named Exports

- `JOB_STATUS` — job status enum
- `createFactory` — factory function for custom instances

### Default Export

```javascript
const queue = createFactory();
export default queue;
```

The singleton is registered on the DI container as `container.resolve('queue')` during engine autoloading.

## 9. Testing

**File:** `queue.test.js`

Uses `__mocks__/uuid.js` (sequential `mock-uuid-N`). Creates a fresh `createFactory()` instance per test.

### Test Coverage (2 describe blocks)

**Factory:**

- Channel creation and singleton return
- Channel name validation (empty, `null`, non-string, whitespace-only)
- `channel()` lookup for existing and non-existing
- `has()` for existing, non-existing, and invalid names
- `getChannelNames()` empty and populated
- `getStats()` empty and multi-channel
- `remove()` existing, non-existing, and invalid names
- `cleanup()` all channels and empty queue
- `registerAdapter()` custom adapter and no-override behavior

**Channel:**

- `on()` registration, validation (event name, handler type), chaining
- `off()` removal and no-throw for non-existing
- `hasHandler()` / `getHandlerCount()`
- `getStats()` with handlers
- `emit()` job creation and null on invalid event
- `emitBulk()` batch and invalid input
- `close()` handler cleanup and processing flag reset

## 10. Integration Points

- **Module `boot({ container })`**: Access via `container.resolve('queue')`. Create channels for domain-specific job processing.
- **Worker Functions**: Queue handlers can call worker functions directly for processing subtasks.
- **Schedule Engine**: Cron handlers can emit jobs to queue channels for rate-limited processing.
- \*\*Extension lifecycle: Extensions use queue channels for background install/toggle operations.

---

_Note: This spec reflects the CURRENT implementation of the queue engine._
