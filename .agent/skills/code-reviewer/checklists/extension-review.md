# Extension Review Checklist

Quick-reference checklist for reviewing `src/extensions/[extension-name]` code.

## Isolation (CRITICAL)

- [ ] **ZERO** direct imports from `src/apps/`
- [ ] **ZERO** direct file modifications in `src/apps/`
- [ ] All cross-module communication via hooks, slots, or IPC pipelines
- [ ] Uses `__EXTENSION_ID__` (compile-time constant), never raw package name in URLs

## Architecture

- [ ] `api/index.js` uses `export default { ... }` with correct hooks
- [ ] Declarative hooks return Webpack contexts: `models()`, `migrations()`, `seeds()`, `translations()`
- [ ] License header present in first 6 lines of every file

## Backend Lifecycle

- [ ] `boot({ container, registry })` registers IPC handlers and hook subscriptions
- [ ] `shutdown({ container, registry })` unsubscribes **every** hook registered in `boot()`
- [ ] `install({ container })` and `uninstall({ container })` wrap all DB ops in `try/catch`
- [ ] IPC registered as: `registry.registerHook('ipc:${__EXTENSION_ID__}:action', ...)`

## Frontend Lifecycle

- [ ] `providers({ container, store })` — Redux injection here, **not** in `boot()`
- [ ] `boot(registry)` — slot and hook registrations
- [ ] `shutdown(registry)` — **exactly inverses** `boot()`

## Memory Leak Audit (CRITICAL)

Count and match:

| `boot()` Registration | `shutdown()` Cleanup |
|------------------------|---------------------|
| `registry.registerSlot(...)` | `registry.unregisterSlot(...)` |
| `registry.registerHook(...)` | `registry.unregisterHook(...)` |
| `hook('ns').on(...)` | `hook('ns').off(...)` |
| `emitter.on(...)` | `emitter.off(...)` |

**Every registration MUST have a corresponding cleanup. Count them.**

## Performance

- [ ] No N+1 queries — batch with `findAll` and `Op.in`
- [ ] Cache invalidated after mutations: `invalidateCache(cache, id)`
- [ ] CPU-intensive work offloaded to Piscina workers
- [ ] Frontend: `useCallback` on prop handlers, `useMemo` on derived data
- [ ] WS handlers debounced to prevent rapid re-fetching
- [ ] Timers cleaned up on unmount

## Conventions

- [ ] Responses use `http.sendSuccess()` etc. — never raw `res.json()`
- [ ] No `??`, `?.`, `??=` (ESLint-banned)
- [ ] Import order follows ESLint groups
- [ ] File naming matches convention
- [ ] Constants use SCREAMING_SNAKE_CASE

## Module-kind Extensions (with routes)

- [ ] `routes()` returns `[moduleName, routesContext]` tuple (not direct context)
- [ ] View `_route.js` files follow module conventions
- [ ] Namespace auto-derived from tuple — verify it's correct

## Testing

- [ ] `.test.js` files colocated with changed code
- [ ] `boot()`/`shutdown()` symmetry tested (register → verify → unregister → verify)
- [ ] IPC handlers tested with mock registry
- [ ] `npm test` and `npm run lint` pass
