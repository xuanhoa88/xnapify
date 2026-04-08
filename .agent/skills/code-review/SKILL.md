---
name: code-review
description: Expert technical reviewer for modules and extensions. Validates architecture, conventions, test coverage, performance, and cross-cutting concerns before merge.
version: 3.0
priority: HIGH
---

# Code Review Agent Skill

You are an expert AI code reviewer. When I share code with you, analyze it thoroughly and provide:

## Code Quality

- Identify code smells, anti-patterns, and areas for improvement
- Suggest refactoring opportunities
- Check for proper naming conventions and code organization

## Bug Detection

- Find potential bugs and logic errors
- Identify edge cases that may not be handled
- Check for null/undefined handling

## Security Analysis

- Identify security vulnerabilities (SQL injection, XSS, etc.)
- Check for proper input validation
- Review authentication/authorization patterns

## Performance

- Identify performance bottlenecks
- Suggest optimizations
- Check for memory leaks or resource issues

## Best Practices

- Verify adherence to language-specific best practices
- Check for proper error handling
- Review test coverage suggestions

Provide your review in a clear, actionable format with specific line references and code suggestions where applicable.

---

In addition to the general guidelines above, you are specifically trained on the `xnapify` architecture. Your role is to critically analyze any new or updated code, focusing on whether the code adheres to our rigorous standards for **Modules** (`src/apps`), **Extensions** (`src/extensions`), and **Shared Infrastructure** (`src/bootstrap`, `shared/`).

When evaluating against the categories above, use the following `xnapify`-specific rules and checklists. Cross-reference with sibling skills — this skill is the **gatekeeper** that verifies other skills were applied correctly.

---

## Review Procedure

### Step 1: Scope the Review

Before reviewing, identify:

| Question                                     | How                                                           |
| -------------------------------------------- | ------------------------------------------------------------- |
| What changed?                                | `git diff --name-only` or list of files                       |
| Is this a module, extension, or shared code? | Check path prefix (`src/apps/`, `src/extensions/`, `shared/`) |
| What depends on the changed code?            | `grep -r` for imports of changed files                        |
| Are there existing tests?                    | Look for `.test.js` files colocated with changed code         |

### Step 2: Apply All Checklist Sections

Run through every section below. Skip sections that don't apply, but **explicitly state** which sections you skipped and why.

### Step 3: Format the Report

Structure your final review using the [Response Format](#response-format) at the bottom.

---

## 1. Code Quality & Style

> ⚠️ **Always enforce the rules defined in the `coding-standards` skill.**
> Do not evaluate style rules natively in this file. Cross-reference `coding-standards` as the single source of truth for:
>
> - Naming Conventions (Variables, Functions, Booleans)
> - Function Design (Size, Arguments, Guard Clauses)
> - Clean Code Principles (DRY, Licenses, Comments)
> - Syntax Restrictions (Banned APIs like Node 17+, `??`, `?.`, `??=`, etc.)

---

## 2. Bug Detection

| Check                            | Description                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Unhandled nulls**              | `container.resolve('x')` may return `undefined` — guard before calling methods                           |
| **Missing `await`**              | Async functions called without `await` cause silent failures                                             |
| **Race conditions**              | Concurrent state mutations without locks, especially in queue handlers and boot hooks                    |
| **Error swallowing**             | Empty `catch {}` blocks hide failures — must at minimum log                                              |
| **Off-by-one**                   | Array indexing, pagination, loop boundaries                                                              |
| **Type coercion**                | `==` vs `===`, implicit falsy checks on `0` or empty strings                                             |
| **Unhandled promise rejections** | Fire-and-forget promises without `.catch()`                                                              |
| **`require.context` at runtime** | All `require.context()` calls must use **static string literals** — Webpack cannot analyze dynamic paths |
| **AbortController missing**      | Long-lived effects (WS listeners, fetch) without abort/cleanup on unmount                                |
| **Stale closure**                | `useCallback`/`useEffect` missing dependencies that change over time                                     |

---

## 3. Security

Defer to the **security-compliance** skill for deep checks. At minimum verify:

| Rule                    | What to Check                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Input validation**    | Every `req.body`, `req.query`, `req.params` validated with Zod via `validateForm(() => schema, data)` or `schema.parse(data)` |
| **RBAC on every route** | API: `export const get = [requirePermission('scope'), handler]`. View: `export const middleware = requirePermission('scope')` |
| **DI for auth**         | Auth resolved via `req.app.get('container').resolve('auth')`, never imported directly                                         |
| **No raw SQL**          | Use Sequelize ORM methods. `sequelize.literal()` only with parameter binding                                                  |
| **Env vars**            | All custom vars use `XNAPIFY_` prefix. Secrets never hardcoded.                                                               |
| **Path traversal**      | File operations must validate: `const rel = path.relative(base, target); if (rel.startsWith('..')) throw`                     |
| **Rate limiting**       | Static asset routes: `export const useRateLimit = false`. High-traffic: custom `{ max, windowMs }`                            |
| **CSP compliance**      | No inline `<script>` without `nonce`. No `eval()` or `new Function()`.                                                        |

---

## 4. Performance

### 4.1 Backend Performance

| Check                         | Description                                               | Fix                                                                   |
| ----------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| **N+1 queries**               | Loop calling `findByPk` per item                          | Batch: `findAll({ where: { id: { [Op.in]: ids } } })`                 |
| **Missing DB indexes**        | New columns in `where` or `order` without migration index | Add index in migration file                                           |
| **Unbounded queries**         | `findAll()` without `limit` on large tables               | Always set `limit` or paginate                                        |
| **Sequential where parallel** | Multiple independent DB/API calls chained with `await`    | `Promise.all([callA(), callB()])`                                     |
| **Blocking event loop**       | CPU work in request handler (hashing, parsing, checksum)  | Offload to worker function: `import { fn } from './workers'`          |
| **Cache misses**              | Repeated expensive lookups without caching                | Use `await cache.get(key)` / `await cache.set(key, val, TTL)` pattern |
| **Cache not invalidated**     | State-changing operations without `invalidateCache()`     | Call `await invalidateCache(cache, id)` after mutations               |
| **Temp file leaks**           | `fs.promises.mkdir` in upload without `finally` cleanup   | Always use `try/finally` to clean temp files                          |

### 4.2 Frontend Performance

| Check                      | Description                                                         | Fix                                             |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| **Missing `useCallback`**  | Event handler passed as prop without memoization                    | Wrap in `useCallback` with correct deps         |
| **Missing `useMemo`**      | Expensive derived data (filtering, sorting) recomputed every render | Wrap in `useMemo`                               |
| **Redundant re-renders**   | State updates that don't change the value                           | Guard: `if (prev === next) return prev`         |
| **Redundant state**        | Data already in Redux re-fetched or stored locally                  | Use selector instead                            |
| **WS debouncing**          | Rapid WS events triggering multiple fetches                         | Debounce with `setTimeout` pattern              |
| **Timer leaks**            | `setTimeout`/`setInterval` not cleaned on unmount                   | Store in `useRef`, clear in `useEffect` cleanup |
| **Heavy imports**          | `import lodash` instead of `import toLower from 'lodash/toLower'`   | Cherry-pick imports                             |
| **Selector recomputation** | Selectors without `createSelector` memoization                      | Use `createSelector` from RTK                   |

### 4.3 SSR Performance

| Check                      | Description                                           | Fix                                    |
| -------------------------- | ----------------------------------------------------- | -------------------------------------- |
| **Slow `getInitialProps`** | Heavy data fetching in SSR path                       | Keep minimal or use cache              |
| **SSR rendering timeout**  | Component triggers unbounded async work during render | Respect `promiseWithDeadline` timeout  |
| **Memory leak in SSR**     | Context not cleaned up after render                   | `context.store.close()`, null out refs |

---

## 5. Conventions

### 5.1 Import Order

> ⚠️ Always enforce the `Import Order` rules found inside the `coding-standards` skill. Do not duplicate them here.

### 5.2 HTTP Response Format

Controllers MUST use the shared HTTP response engine (`container.resolve('http')`), never raw `res.json()`:

| Response Type    | Method                                                   | When                       |
| ---------------- | -------------------------------------------------------- | -------------------------- |
| Success          | `http.sendSuccess(res, data)`                            | Default success            |
| Created          | `http.sendCreated(res, data)`                            | POST that creates resource |
| Accepted         | `http.sendAccepted(res)`                                 | Async job queued           |
| Validation error | `http.sendValidationError(res, errors)`                  | Zod/form validation failed |
| Not found        | `http.sendNotFound(res, message)`                        | Resource lookup failed     |
| Unauthorized     | `http.sendUnauthorized(res)`                             | Missing/invalid auth       |
| Forbidden        | `http.sendForbidden(res)`                                | Insufficient permissions   |
| Server error     | `http.sendServerError(res, message, err)`                | Catch-all for exceptions   |
| Paginated        | `http.sendPaginated(res, items, { page, limit, total })` | List endpoints             |

> ❌ **Never** `res.json(data)` or `res.status(200).json(...)` directly.
> ❌ **Never** expose `err.stack` in responses — `sendServerError` sanitizes automatically.

### 5.3 Controller → Service Layering

| Layer          | Responsibility                                            | Anti-pattern                 |
| -------------- | --------------------------------------------------------- | ---------------------------- |
| **Controller** | Resolve DI, validate input, call service, format response | Business logic in controller |
| **Service**    | Business logic, DB operations, cache management           | Accessing `req`/`res`        |
| **Helpers**    | Shared utilities used by 2+ service functions             | One-off helper files         |

```javascript
// ✅ Correct: Controller is thin
export const listItems = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const items = await itemService.listItems({
      models: container.resolve('models'),
      cache: container.resolve('cache'),
    });
    return http.sendSuccess(res, { items });
  } catch (err) {
    return http.sendServerError(res, 'Failed to list items', err);
  }
};
```

### 5.4 File Naming

| Type              | Convention                      | Example                       |
| ----------------- | ------------------------------- | ----------------------------- |
| **Controllers**   | `{resource}.controller.js`      | `extension.controller.js`     |
| **Services**      | `{resource}.service.js`         | `extension.service.js`        |
| **Helpers**       | `{resource}.helpers.js`         | `extension.helpers.js`        |
| **Queue workers** | `{resource}.workers.js`         | `extension.workers.js`        |
| **Tests**         | `{source}.test.js` (colocated)  | `extension.service.test.js`   |
| **Validators**    | `{resource}.js` in `validator/` | `validator/extension.js`      |
| **Selectors**     | `selector.js` in `redux/`       | `redux/selector.js`           |
| **Thunks**        | `thunks.js` in `redux/`         | `redux/thunks.js`             |
| **Slice**         | `slice.js` in `redux/`          | `redux/slice.js`              |
| **Components**    | `PascalCase.js`                 | `ExtensionCard.js`            |
| **CSS Modules**   | `PascalCase.css`                | `ExtensionCard.css`           |
| **Routes**        | `_route.js`                     | `(admin)/(default)/_route.js` |

### 5.5 Error Handling Patterns

| Layer                   | Correct Pattern                                                        | Anti-pattern                        |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| **Controller**          | `try/catch` → `http.sendServerError(res, msg, err)`                    | `throw new Error()` without handler |
| **Service**             | Let errors bubble up. Use custom error classes with `.status`.         | Silent `catch {}`                   |
| **Worker (Queue)**      | Log + re-throw so queue marks job failed                               | `catch {}` that silently succeeds   |
| **Worker (Function)**   | Let error propagate to caller                                          | Wrapping in unnecessary `try/catch` |
| **Extension lifecycle** | `try/catch` in `install()` / `uninstall()`                             | Unguarded DB ops                    |
| **Frontend thunks**     | `rejectWithValue(error.data && error.data.message \|\| error.message)` | `return undefined` on error         |
| **Frontend AbortError** | `if (error.name === 'AbortError') return []`                           | Treating abort as failure           |

### 5.6 WebSocket Notification Pattern

| Event                   | When                   | WS Payload                                  |
| ----------------------- | ---------------------- | ------------------------------------------- |
| `EXTENSION_INSTALLED`   | Install job completed  | `{ type, extensionId, data: { manifest } }` |
| `EXTENSION_ACTIVATED`   | Toggle on completed    | `{ type, extensionId, data: { manifest } }` |
| `EXTENSION_DEACTIVATED` | Toggle off completed   | `{ type, extensionId }`                     |
| `EXTENSION_UNINSTALLED` | Delete job completed   | `{ type, extensionId }`                     |
| `EXTENSION_*_FAILED`    | Any job failed         | `{ type, extensionId }`                     |
| `EXTENSION_TAMPERED`    | Integrity check failed | `{ type, extensionId }`                     |

Frontend handler flow: `clearAction(id)` → `debouncedFetch()` → toast message.

---

## 6. Module Architecture (`src/apps/[module_name]`)

### 6.1 Directory Structure

```
src/apps/[module_name]/
├── api/
│   ├── index.js              # Lifecycle hooks (default export)
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── models/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   └── workers/              # (optional) Worker functions
├── views/
│   ├── index.js              # View lifecycle hooks (default export)
│   ├── (admin)/(default)/    # Nested routes
│   │   ├── _route.js
│   │   ├── ComponentName.js
│   │   ├── ComponentName.css
│   │   ├── components/       # Route-local components
│   │   └── redux/            # Colocated Redux feature
│   │       ├── index.js      # Barrel export (public API)
│   │       ├── slice.js      # createSlice + SLICE_NAME + normalizeState
│   │       ├── thunks.js     # createAsyncThunk definitions
│   │       └── selector.js   # createSelector-based selectors
│   └── translations/
├── validator/                # Zod schemas
└── translations/
```

### 6.2 Backend Hooks (`api/index.js`)

**MUST** use `export default { ... }` with phase-sequential lifecycle hooks.

| Hook                       | Phase | Returns                      | Notes                                                 |
| -------------------------- | ----- | ---------------------------- | ----------------------------------------------------- |
| `translations()`           | 1     | Webpack context              | i18n JSON files                                       |
| `providers({ container })` | 2     | —                            | Bind DI services                                      |
| `migrations()`             | 3     | Webpack context              | Auto-run, declarative                                 |
| `models()`                 | 4     | Webpack context              | Auto-registered into ORM                              |
| `seeds()`                  | 5     | Webpack context              | Auto-run, declarative                                 |
| `boot({ container })`      | 6     | —                            | Register workers, hooks, schedules. Models available. |
| `routes()`                 | 7     | Webpack context **directly** | `() => routesContext` (**not** a tuple)               |

> ⚠️ **Key distinction:** Modules return Webpack context **directly** from `routes()`. Extensions return `[name, context]` tuple.

### 6.3 Frontend Hooks (`views/index.js`)

| Hook                              | Phase | Notes                                                                |
| --------------------------------- | ----- | -------------------------------------------------------------------- |
| `translations()`                  | 1     | Returns webpack context                                              |
| `providers({ container, store })` | 2     | Inject Redux reducers via `store.injectReducer(SLICE_NAME, reducer)` |
| `boot({ container })`             | 3     | —                                                                    |
| `routes()`                        | 4     | Webpack context **directly**                                         |

### 6.4 Route Files (`_route.js`)

| Export                             | Type                         | Purpose                                          |
| ---------------------------------- | ---------------------------- | ------------------------------------------------ |
| `middleware`                       | `false \| Function \| Array` | RBAC guard or opt-out                            |
| `init({ store })`                  | Function                     | Reducer injection (legacy; prefer `providers()`) |
| `setup({ store, i18n })`           | Function                     | Register sidebar menu via `registerMenu()`       |
| `teardown({ store })`              | Function                     | Unregister menu via `unregisterMenu()`           |
| `mount({ store, i18n, path })`     | Function                     | Add breadcrumbs via `addBreadcrumb()`            |
| `unmount({ store })`               | Function                     | Cleanup on route exit                            |
| `getInitialProps({ fetch, i18n })` | Async                        | SSR data fetching (keep lightweight)             |
| `namespace`                        | String                       | Override extension namespace                     |
| `useRateLimit`                     | `false \| Object`            | Rate limit override (API routes only)            |
| `translations()`                   | Function                     | Route-specific translations                      |
| `export default Component`         | React component              | **Required** — page component                    |

### 6.5 Module Review Checks

| Rule                        | Violation Example                               | Fix                                                                      |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **No cross-domain imports** | `import X from '@apps/other-module/...'`        | `container.resolve()` or hook system                                     |
| **DI for auth**             | `import auth from '@shared/auth'`               | `req.app.get('container').resolve('auth')`                               |
| **Static Webpack paths**    | `require.context(\`${dir}\`)`                   | Static string literal only                                               |
| **Redux in providers**      | `store.injectReducer()` in `_route.js` `init()` | Move to `views/index.js` `providers()`                                   |
| **No direct email**         | `import sendEmail from '...'`                   | `container.resolve('emails:send')` or `hook('emails').emit('send', ...)` |
| **Response format**         | `res.json({ data })`                            | `http.sendSuccess(res, { data })`                                        |

---

## 7. Extension Architecture (`src/extensions/[extension-name]`)

### 7.1 Extension Kinds

| Kind       | Has `routes()` | Namespace                                                         |
| ---------- | -------------- | ----------------------------------------------------------------- |
| **Plugin** | ❌ No          | Subscribes to target routes via `defineExtension()`               |
| **Module** | ✅ Yes         | Auto-derived from `routes()` return tuple `[moduleName, context]` |

### 7.2 Backend Hooks (`api/index.js`)

| Hook                                | Category    | Notes                                           |
| ----------------------------------- | ----------- | ----------------------------------------------- |
| `models()`                          | Declarative | Auto-registered via `ModelRegistry.discover()`  |
| `migrations()`                      | Declarative | Auto-run with `__EXTENSION_ID__` prefix         |
| `seeds()`                           | Declarative | Auto-run with `__EXTENSION_ID__` prefix         |
| `translations()`                    | Declarative | Auto-registered, auto-cleaned                   |
| `install({ container })`            | One-time    | Runs once on install                            |
| `boot({ container, registry })`     | Lifecycle   | Re-runs every server boot. Register IPC, hooks. |
| `shutdown({ container, registry })` | Lifecycle   | **MUST** unsubscribe all hooks from `boot()`.   |
| `uninstall({ container })`          | One-time    | Runs once on delete. `try/catch` all DB ops.    |

### 7.3 Frontend Hooks (`views/index.js`)

| Hook                              | Notes                                                |
| --------------------------------- | ---------------------------------------------------- |
| `translations()`                  | Returns webpack context                              |
| `providers({ container, store })` | Redux injection — **NOT** in `boot()`                |
| `boot(registry)`                  | Register slots, hooks, IPC handlers                  |
| `shutdown(registry)`              | **MUST exactly inverse `boot()`** — count must match |

### 7.4 Extension Review Checks

| Rule                                  | What to Check                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Isolation**                         | ❌ **NEVER** directly import from `src/apps/`                                                                                                      |
| **Memory leak prevention** [CRITICAL] | Every listener in `boot()` must have `.off()` / `unregister()` in `shutdown()`. **Count them — they MUST match.**                                  |
| **IPC pipelines**                     | Backend: `registry.registerHook('ipc:${__EXTENSION_ID__}:action', ...)`. Frontend: `context.fetch('/api/extensions/${__EXTENSION_ID__}/ipc', ...)` |
| **Identity constant**                 | Use `__EXTENSION_ID__` for IPC, URLs, namespaces, logging. **Never** raw package name.                                                             |
| **Defensive lifecycle**               | All DB ops in `install()`/`uninstall()` wrapped in `try/catch`                                                                                     |
| **Redux in providers**                | `store.injectReducer()` in `providers()`, not `boot()`                                                                                             |
| **Module-kind routes**                | `routes()` returns `[moduleName, routesContext]` tuple                                                                                             |

---

## 8. CSS Modules

| Rule              | ✅ Correct                                          | ❌ Incorrect                                                                |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Import style      | `import s from './Component.css'`                   | `import './Component.css'`                                                  |
| Class usage       | `className={s.container}`                           | `className="container"`                                                     |
| Dynamic classes   | `className={clsx(s.tab, { [s.active]: isActive })}` | String concatenation                                                        |
| Composition       | CSS Modules `composes`                              | Duplicate CSS across files                                                  |
| No inline styles  | —                                                   | `style={{ color: 'red' }}` (except `{ display: 'none' }` for hidden inputs) |
| No global classes | —                                                   | Global `.container {}` overriding module scope                              |

---

## 9. Redux Conventions

### 9.1 Structure

| Rule              | What to Check                                                           |
| ----------------- | ----------------------------------------------------------------------- |
| **Colocated**     | Redux features in `views/{view-path}/redux/` — never in shared renderer |
| **Barrel export** | All public API funneled through `redux/index.js`                        |
| **SLICE_NAME**    | Namespaced constant like `@admin/extensions`, exported from `slice.js`  |

### 9.2 Slice Design

| Rule                                   | What to Check                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| **Per-operation tracking**             | Each CRUD op has independent `{ loading, error }` state via `createOperationState()` |
| **`normalizeState`**                   | Exported function that handles SSR hydration and state migration                     |
| **Error clearing**                     | `clearXxxError` action for each operation, dispatched on unmount                     |
| **Reset action**                       | `resetXxxState` action that returns `initialState`                                   |
| **`Object.assign(state, normalized)`** | Immer pattern for state updates after normalization                                  |

### 9.3 Thunks

| Rule                 | What to Check                                                                    |
| -------------------- | -------------------------------------------------------------------------------- |
| **`extra.fetch`**    | `{ extra: { fetch }, rejectWithValue }` — never `window.fetch` or `import fetch` |
| **Error handling**   | `return rejectWithValue(error.data && error.data.message \|\| error.message)`    |
| **AbortError guard** | `if (error.name === 'AbortError') return []` — don't reject on abort             |
| **Thunk prefix**     | `'admin/module/actionName'` — matches SLICE_NAME format                          |

### 9.4 Selectors

| Rule                        | What to Check                                                        |
| --------------------------- | -------------------------------------------------------------------- |
| **Use `SLICE_NAME`**        | `state[SLICE_NAME]` — not hardcoded string                           |
| **`normalizeState` guard**  | `normalizeState(state && state[SLICE_NAME])` in base selectors       |
| **`createSelector`**        | Memoized selectors for derived data (sorted lists, filtered results) |
| **Per-operation selectors** | `isXxxLoading`, `getXxxError` for each operation                     |

---

## 10. Worker Conventions

### 10.1 Worker Functions (Direct Calls)

| Rule                     | What to Check                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Directory**            | `api/workers/index.js` for barrel, `*.worker.js` for standalone functions                         |
| **Barrel pattern**       | `index.js` calls the FS factory or search module directly (FS workers are merged into barrel)     |
| **Exports**              | Single-function workers: `export default` (camelCase). Multi-function: named `export` (camelCase) |
| **Dependencies as args** | Pass `models`, `search`, `container` as function args — not imported at module level              |

### 10.2 Queue-Based Workers (Stateful)

| Rule                    | What to Check                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| **Location**            | `api/services/{module}.workers.js`                                        |
| **Registration**        | `channel.on('jobName', handler)` in `registerXxxWorkers()`                |
| **Boot hook**           | `registerXxxWorkers(container)` called from module's `boot()`             |
| **Queue lifecycle**     | `queue.on('completed', ...)` and `queue.on('failed', ...)` handlers exist |
| **Failed job recovery** | DB state reverted on failure (e.g., `is_active` rollback)                 |
| **WS notifications**    | `notifyExtensionChange()` or equivalent called after job completes/fails  |

### 10.3 Thread Pool Workers (Tier 2)

| Rule                    | What to Check                                                                 |
| ----------------------- | ----------------------------------------------------------------------------- |
| **`THREADED` flag**     | Worker file exports `THREADED = true`                                         |
| **No DI dependencies**  | No imports of `container`, `models`, `search`, `db`                           |
| **Serializable I/O**    | All inputs and outputs are JSON-serializable (no functions, classes, Buffers) |
| **Pure functions**      | No side effects on shared state                                               |
| **Called via engine**   | `worker.run('name', 'fn', data)` from barrel, not direct import               |
| **Manifest registered** | Worker compiled by webpack and appears in `worker-manifest.json`              |

---

## 11. Testing

| Rule                  | What to Check                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Colocated**         | `.test.js` files live next to source files                                                                            |
| **Coverage**          | New code paths have corresponding tests. Bug fixes include regression tests.                                          |
| **No skipped tests**  | `it.skip`, `describe.skip`, `xit` without tracked issue                                                               |
| **Thunk testing**     | Use real `configureStore` with `store.injectReducer(SLICE_NAME, reducer)` and mock `fetch` via `{ fetch: mockFetch }` |
| **Component testing** | Use `App` context wrapper with `store`, `i18n`, `history`, `fetch`                                                    |
| **Selector testing**  | Test with `createState` helper wrapping `SLICE_NAME`                                                                  |
| **Worker testing**    | Test handler functions directly (they're just async functions)                                                        |
| **`act()` wrapping**  | State updates and renders wrapped in `act()`                                                                          |
| **Cleanup**           | Components unmounted in `afterEach` or test body                                                                      |
| **Validator mocking** | `jest.mock('@shared/validator')` — mock `validateForm`                                                                |
| **Test passes**       | `npm test` passes. `npm run lint` passes.                                                                             |

---

## 12. i18n & Localization

> ⚠️ Always enforce the rules defined in the `i18n-localization` skill. Do not duplicate the checks here. Cross-reference it for detecting hardcoded strings, translations hooks, interpolation patterns, etc.

---

## 13. Cross-Skill Verification

The code-review checks that other skills' output is correct:

| Skill                        | What to Verify                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| **module-development**       | Lifecycle hooks match phase order, route format correct, DI used properly           |
| **extension-development**    | `boot`/`shutdown` symmetry, IPC uses `__EXTENSION_ID__`, no `src/apps/` imports     |
| **security-compliance**      | Zod validation present, RBAC guards, env var prefix, no raw SQL, CSP compliance     |
| **coding-standards**         | SRP, DRY, naming, syntax restrictions (`??`, `?.`, `??=`), functions under 20 lines |
| **requirement-traceability** | Code traces to spec requirements, no unauthorized additions, amendments documented  |
| **i18n-localization**        | No hardcoded strings, translation hook exists, fallback strings provided            |
| **frontend-design**          | CSS Modules used, no inline styles, responsive considerations                       |

---

## Response Format

Structure your review with these sections. Use severity indicators.

### Severity Levels

| Severity          | Meaning                                                                     | Action Required |
| ----------------- | --------------------------------------------------------------------------- | --------------- |
| 🔴 **CRITICAL**   | Blocks merge. Security vulnerability, data loss, or architectural violation | Must fix        |
| 🟡 **WARNING**    | Likely bug, performance issue, or convention violation                      | Should fix      |
| 🟢 **SUGGESTION** | Improvement opportunity, readability, or best practice                      | Nice to have    |
| ✅ **GOOD**       | Noteworthy positive patterns                                                | Acknowledge     |

### Report Structure

```markdown
# Code Review: [module/extension name]

## Summary

Brief overall assessment (1-2 sentences).

## Architecture & Compliance

- 🔴 [file:line] Rule violated — description. Fix: ...
- 🟡 [file:line] Convention missed — description. Fix: ...
- ✅ Lifecycle hooks correctly ordered.

## Bugs & Edge Cases

- 🔴 [file:line] Unhandled null — `container.resolve('x')` may return undefined.
- 🟡 [file:line] Missing `await` on async call.

## Security

- 🔴 [file:line] Missing Zod validation on req.body.
- ✅ All routes have RBAC guards.

## Performance

- 🟡 [file:line] N+1 query in loop — use batch `findAll`.
- 🟡 [file:line] Missing `useCallback` on handler passed as prop.
- 🟢 [file:line] Consider `Promise.all()` for parallel DB calls.

## Conventions

- 🟡 [file:line] Using `res.json()` directly — use `http.sendSuccess()`.
- 🟡 [file:line] Magic number `30000` — extract to `WORKER_TIMEOUT_MS`.
- 🟡 [file:line] Import order out of compliance — run `npm run fix`.
- ✅ Clean separation of concerns.

## Testing

- 🔴 No tests for new service logic.
- 🟢 [file:line] Consider adding edge case test for empty input.

## Verdict

**APPROVE** | **REQUEST CHANGES** | **NEEDS DISCUSSION**
```

### Rules for Verdicts

| Verdict              | When                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| **APPROVE**          | No 🔴 issues. 🟡 issues are minor and don't affect correctness.                         |
| **REQUEST CHANGES**  | Any 🔴 issue present. OR multiple 🟡 issues that together indicate structural problems. |
| **NEEDS DISCUSSION** | Architectural decisions that need team input before proceeding.                         |

---

## When to Apply This Skill

- When reviewing PRs or branch diffs
- During `/modify` workflow execution (mandatory before completing)
- When a user asks to "review" or "check" code
- After any new module or extension is generated
- Before merging feature branches
