# Module Review Checklist

Quick-reference checklist for reviewing `src/apps/[module_name]` code.

## Architecture

- [ ] `api/index.js` uses `export default { ... }` with lifecycle hooks
- [ ] Phase order: `translations → providers → migrations → models → seeds → boot → routes`
- [ ] `routes()` returns Webpack context **directly** (not a tuple)
- [ ] `require.context()` calls use **static string literals** only
- [ ] License header present in first 6 lines of every file

## Backend

- [ ] Controllers are thin — resolve DI, validate, call service, respond
- [ ] All responses use `http.sendSuccess()` / `http.sendServerError()` — never raw `res.json()`
- [ ] Input validated with `validateForm(() => schema, req.body)` or `schema.parse()`
- [ ] Services accept dependencies as options: `fn(id, { models, cache, cwd })`
- [ ] Errors use custom classes with `.status`: `ExtensionError.notFound()`
- [ ] Queue workers registered in `boot()` via `registerXxxWorkers(container)`
- [ ] Worker handlers have `completed` and `failed` event handlers
- [ ] Failed jobs revert DB state and send failure WS notifications

## Frontend

- [ ] `views/index.js` uses `export default { ... }` with lifecycle hooks
- [ ] Redux reducers injected in `providers()` via `store.injectReducer(SLICE_NAME, reducer)`
- [ ] `_route.js` exports: `middleware`, `init`, `setup`, `teardown`, `mount`, `unmount`, `getInitialProps`, default component
- [ ] CSS Modules: `import s from './Component.css'`, classes via `s.className`

## Performance

- [ ] No N+1 queries — use batch `findAll` with `Op.in`
- [ ] No `findAll()` without `limit` on large tables
- [ ] Independent DB calls run in parallel with `Promise.all()`
- [ ] Event handlers passed as props wrapped in `useCallback`
- [ ] Expensive derived data wrapped in `useMemo`
- [ ] Timers stored in `useRef`, cleaned up in `useEffect` return
- [ ] WS handlers debounced to prevent rapid re-fetching

## Conventions

- [ ] Import order follows ESLint groups: builtin → external → @shared → parent → sibling → CSS
- [ ] No `??`, `?.`, `??=` — banned by ESLint
- [ ] File naming follows convention: `resource.controller.js`, `resource.service.js`, `PascalCase.js`
- [ ] Constants use SCREAMING_SNAKE_CASE — no magic numbers inline

## Redux

- [ ] `SLICE_NAME` constant exported: `@admin/module`
- [ ] `normalizeState()` handles SSR hydration
- [ ] Per-operation `{ loading, error }` tracking
- [ ] `clearXxxError` actions for each operation
- [ ] Thunks use `extra.fetch` — not `window.fetch`
- [ ] Selectors use `normalizeState(state && state[SLICE_NAME])`
- [ ] Derived data selectors use `createSelector`
- [ ] Public API exported via `redux/index.js` barrel

## Cross-cutting

- [ ] No cross-domain imports between `src/apps/` modules
- [ ] Auth via DI: `container.resolve('auth')` or `req.app.get('container').resolve('auth')`
- [ ] Emails via `hook('emails').emit('send', ...)` or `container.resolve('emails:send')`
- [ ] All routes have RBAC guards or explicit `export const middleware = false`
- [ ] User-facing strings use `t('namespace:key', 'Default fallback')`
- [ ] Tests colocated (`.test.js` next to source), covering new code paths
- [ ] `npm test` and `npm run lint` pass
