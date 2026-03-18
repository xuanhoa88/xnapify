# Queue Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Queue Engine at `shared/api/engines/queue`.

---

## Objective

Provide a channel-based job queue for background processing with pub/sub semantics, priority/delay support, retry logic, and pluggable adapters.

## 1. Architecture

```
shared/api/engines/queue/
├── index.js          # Default singleton, re-exports JOB_STATUS
├── factory.js        # QueueFactory class + createFactory()
├── channel.js        # QueueChannel class
├── errors.js         # QueueError class
├── adapters/         # Backend adapters (memory)
├── utils/            # Constants (JOB_STATUS)
│   └── constants.js  # JOB_STATUS enum
├── __mocks__/        # Jest mocks
└── queue.test.js     # Tests
```

## 2. QueueFactory (`factory.js`)

- Manages channels via `Map<name, QueueChannel>`.
- Callable: `queue('name')` === `queue.channel('name')`.
- `registerAdapter(name, Adapter)` — register custom queue backends.
- `getStats()` — returns per-channel stats (names, handler counts).
- Auto-calls `cleanup()` on process exit.

## 3. QueueChannel (`channel.js`)

- `on(event, handler)` — register event handler.
- `emit(event, data, options?)` — publish a job with optional `priority`, `delay`, `retries`.
- Jobs processed with concurrency control.
- Built-in retry with exponential backoff.

## 4. Default Singleton

`index.js` exports `createFactory()`. Registered on DI as `app.get('queue')`.

---

*Note: This spec reflects the CURRENT implementation of the queue engine.*
