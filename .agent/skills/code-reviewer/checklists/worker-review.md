# Worker Review Checklist

Quick-reference for reviewing Piscina worker pools and queue workers.

## Piscina Worker Pool

### Pool Creation

- [ ] Uses `createWorkerPool(name, options)` from `@shared/api/engines/worker`
- [ ] Pool name is descriptive and unique (e.g., `'Extensions'`, `'UsersSearch'`)
- [ ] `maxWorkers` set appropriately (1-4, not unlimited)
- [ ] `workerTimeout` set for expected workload duration
- [ ] Extensions use `forceFork: true` (always thread pool, not same-process)

### Worker Files

- [ ] Named `<type>.worker.js` (e.g., `checksum.worker.js`)
- [ ] Located in `api/workers/` directory
- [ ] Exported functions match message types used in `sendRequest()`
- [ ] Pure functions — no global state, no side effects
- [ ] Data is serializable (no functions, classes, or circular references)

### Convenience Methods

- [ ] Attached via `pool.methodName = async function methodName(...) { ... }`
- [ ] Uses `this.sendRequest(workerType, messageType, data, { throwOnError: true })`
- [ ] Method name matches domain action (e.g., `computeChecksum`, `indexAllUsers`)

### Lifecycle

- [ ] Core modules: pool created in `providers()`, used in `boot()`
- [ ] Extensions: pool created lazily in `boot()` via factory function
- [ ] Extensions: `pool.cleanup()` called in `shutdown()` — leaked threads crash HMR
- [ ] Pool bound to DI container with `OWNER_KEY` symbol

```javascript
// Core module pattern:
container.bind('moduleName:worker', () => workerPool, OWNER_KEY);

// Extension pattern:
let pool = null;
boot() { pool = createPool(); }
shutdown() { pool.cleanup(); pool = null; }
```

## Queue Workers

### Registration

- [ ] Worker registered via `queue.channel.on('jobType', handler)`
- [ ] Handler is async and processes one job at a time
- [ ] Job data is serializable (JSON-safe)

### Error Handling

- [ ] Worker catches errors and logs them
- [ ] Failed jobs re-throw for queue retry mechanism
- [ ] No swallowed errors (catch + ignore)

### Concurrency

- [ ] Queue `concurrency` setting appropriate for workload
- [ ] SQLite: `concurrency: 1` to avoid SQLITE_BUSY
- [ ] PostgreSQL/MySQL: higher concurrency OK

## Testing

- [ ] Worker handler tested directly (call exported function)
- [ ] Pool methods tested via `sendRequest()` mock
- [ ] Error cases tested (timeout, worker crash, invalid input)
- [ ] No real Piscina threads in unit tests (mock the pool)
- [ ] Tests clean up pools in `afterEach`
