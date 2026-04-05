# Engine Review Checklist

Quick-reference for reviewing changes to `shared/api/engines/*`.

## Structure

- [ ] `index.js` exports singleton + named re-exports (`createFactory`, class, errors)
- [ ] `factory.js` has Manager class + `createFactory()` function
- [ ] `errors.js` has custom error class with `code`, `statusCode`, `timestamp`
- [ ] `SPEC.md` exists and reflects current implementation
- [ ] Test file `<engine>.test.js` exists

## Factory Pattern

- [ ] Constructor accepts config object with defaults
- [ ] `createFactory()` registers `SIGTERM` + `SIGINT` handlers via `process.once()`
- [ ] Singleton created at module level (not lazily)
- [ ] `cleanup()` method releases all resources (connections, pools, timers)

## DI Integration

- [ ] Singleton auto-registered on container during bootstrap
- [ ] Service key documented in SPEC.md
- [ ] No circular dependencies with other engines

## Error Handling

- [ ] Custom error class extends `Error`
- [ ] `Error.captureStackTrace` used for clean stacks
- [ ] Error codes are SCREAMING_SNAKE_CASE
- [ ] Status codes follow HTTP conventions (400, 404, 500)

## Testing

- [ ] Tests create fresh instances (not using singleton)
- [ ] `afterEach` calls `cleanup()` to prevent state leakage
- [ ] Error paths tested with correct error class assertions
- [ ] Factory function tested (returns instance, registers signals)
- [ ] Manual mocks in `__mocks__/` for external dependencies
- [ ] No `.skip` or `.only` in committed tests

## Environment Variables

- [ ] All env vars prefixed with `XNAPIFY_`
- [ ] Defaults provided for development
- [ ] No hardcoded secrets
- [ ] Documented in SPEC.md env vars table

## Performance

- [ ] Lazy initialization for expensive resources
- [ ] `getStats()` method for monitoring
- [ ] No synchronous I/O in hot paths
