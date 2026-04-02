# Worker Review Checklist

Quick-reference for reviewing worker functions and queue workers.

## Worker Functions (Direct Calls)

### Barrel File (`workers/index.js`)

- [ ] Exports convenience functions wrapping underlying `*.worker.js` exports
- [ ] Functions accept explicit dependencies (models, search, container) as args
- [ ] No side effects at module level — all work inside function bodies
- [ ] Function names are descriptive domain actions (e.g., `indexAllUsers`, `logActivity`)

### Worker Files

- [ ] Named `<type>.worker.js` (e.g., `checksum.worker.js`)
- [ ] Located in `api/workers/` directory
- [ ] Exported as SCREAMING_SNAKE functions (e.g., `COMPUTE_CHECKSUM`, `LOG_ACTIVITY`)
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

## Testing

- [ ] Worker handler tested directly (call exported function)
- [ ] Dependencies mocked (models, search, container)
- [ ] Error cases tested (invalid input, DB failure)
- [ ] Tests don't require real infrastructure (DB, search engine)
