# Worker Review Checklist

Quick-reference for reviewing worker functions and queue workers.

## Worker Functions (Direct Calls)

### Barrel File (`workers/index.js`)

- [ ] Exports convenience functions that call the FS factory or search engine directly
- [ ] For FS: all operations merged into `workers/index.js` (no separate `*.worker.js` files)
- [ ] Functions accept explicit dependencies (models, search, container) as args
- [ ] No side effects at module level — all work inside function bodies
- [ ] Function names are descriptive domain actions (e.g., `indexAllUsers`, `logActivity`)

### Worker Files

- [ ] Named `<type>.worker.js` (e.g., `search.worker.js`, `activities.worker.js`)
- [ ] Located in `api/workers/` directory
- [ ] Single-function workers use `export default` (camelCase)
- [ ] Multi-function workers use named `export` (camelCase, e.g., `indexAllUsers`)
- [ ] Pure async functions — dependencies passed as args, not imported globally

### Lifecycle

- [ ] Core modules: worker functions called from `boot()` or hook listeners
- [ ] Extensions: worker functions imported via `require('./workers')` in `boot()`
- [ ] No pool creation, no DI binding — just direct function calls
- [ ] Search hooks registered via `registerSearchHooks(container, search)` pattern

```javascript
// Core module pattern:
async boot({ container }) {
  const { indexAllItems, registerSearchHooks } = require('./workers');
  registerSearchHooks(container, search);
}

// Extension pattern:
boot({ container }) {
  const { computeHash } = require('./workers');
  // use in IPC handlers
}
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

## Thread Pool Workers (Tier 2)

### Eligibility

- [ ] Worker is CPU-bound (not I/O-bound)
- [ ] Worker exports `THREADED = true`
- [ ] No DI imports (`container`, `models`, `search`, `db`)
- [ ] All inputs are JSON-serializable (no functions, classes, Buffers)
- [ ] All outputs are JSON-serializable
- [ ] Pure functions only — no shared mutable state

### Integration

- [ ] Called via `worker.run('workerName', 'fnName', data)` from barrel
- [ ] Worker engine resolved from DI: `container.resolve('worker')`
- [ ] Worker file compiled by webpack as standalone CJS
- [ ] Worker file outputs to `BUILD_DIR` as `*.worker.js` (auto-discovered at startup)

## Testing

- [ ] Worker handler tested directly (call exported function)
- [ ] Dependencies mocked (models, search, container)
- [ ] Error cases tested (invalid input, DB failure)
- [ ] Tests don't require real infrastructure (DB, search engine)
