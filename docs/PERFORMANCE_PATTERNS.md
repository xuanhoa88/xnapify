# Performance Patterns & Architectural Guidelines

This document collects repeatable patterns, do's & don'ts, and architectural
advice for keeping the **React Starter Kit** fast and scalable.  Developers
should refer to this when adding features, writing middleware, or modifying
core systems.

---

## 1. Caching Strategies

### HTTP & SSR
- **In‑memory SSR cache** (`appState.ssrCache`) stores HTML for GET requests
  without query params.  Key includes path, locale and hashed auth header.
  Cache is enabled via `config.enableSSRCache` and TTL via `config.ssrCacheTTL`.
- **Fragment caching** can be added by plugins or modules using custom keys
  stored in `req.app.get('cache')` (typically Redis) during the render process.

### Authentication
- JWT verification is expensive: cache decoded tokens for 60 s and invalidate
  on logout using `clearJwtCache()`.
- RBAC data is cached per user in `rbacCache`.  Use parallel DB queries
  (`Promise.all`) when assembling the data on a cache miss.
- Be aggressive with TTLs for auth and RBAC caches; they are cheaper than the
  alternative of hitting the database every request.

### Locale & Other Short-lived Data
- Locale detection uses a small LRU-like Map keyed by cookie + `Accept-Language`.
  Cache entries expire after 5 minutes (`LOCALE_CACHE_TTL`).
- When adding other parse-heavy middleware (e.g. user-agent, geo-IP), cache
  results for a short duration per request signature.

### Database
- Use Sequelize `include`/eager-loading to avoid N+1 queries for associations.
- Add appropriate indexes in migrations (see user/role/group tables) and
  periodically audit slow queries with `sequelize.options.logging`.
- For read-heavy tables, consider a separate read replica or Redis cache.

---

## 2. Middleware & Request Flow

- **Order matters:** keep lightweight, frequently-hit middleware earlier (auth,
  rate-limit).  Delay disk/Io operations (static file lookup, Node-RED proxy)
  until after the API router.
- **Compose once:** `composeMiddleware()` performs type checking on composition
  time only; avoid building middleware stacks inside request handlers.
- **Avoid synchronous blocking code** in middleware; prefer async functions with
  `await` or streaming when handling large payloads.
- **Shared state** (e.g. `req.token`, `req.user`) should be set as early as
  possible to allow downstream middleware to shortcut.
- **Metrics instrumentation** should wrap the entire request and emit
  durations along with labels.  The built-in timing middleware logs to console
  when no metrics provider is configured.

---

## 3. Plugin Architecture

- **Hooks** are the primary extension mechanism.  Callbacks are executed in
  parallel by default (`Hook.execute`), improving throughput when many plugins
  listen to the same event.
  - If a hook depends on the result of another, the plugin should orchestrate
    them explicitly (e.g. `await hook('foo').execute(...); await hook('bar')...`).
- **Slots** render UI components in order based on `order` metadata; keep slot
  renderers lightweight and memoized if possible.
- **Registration overhead** is minimal (Map/Set operations), but avoid
  re-registering the same callback during hot-reload loops.
- **Lifecycle events** (`plugin:loaded`, `plugin:unloaded`) are emitted via the
  same hook system; listeners should always handle errors and avoid blocking
  startup.

---

## 4. Rendering & Redux

- **Store configuration** is cheap (~130 µs); repeated injections of the same
  reducer are no‑ops.  Use `store.injectReducer()` inside `boot` hooks.
- **Selector memoization** (e.g. via `reselect`) prevents unnecessary
  recalculations during SSR and client hydration.
- **Streaming SSR** (`renderToNodeStream`) can reduce time‑to-first-byte for
  large pages, but requires careful handling of data dependencies.
- **Avoid serializing the entire Redux state** when only a subset changes; use
  `store.serialize()` helpers or pass explicit props.

---

## 5. Network & IPC

- **Keep‑alive HTTP agents** significantly improve throughput for repeated
  requests (used in `tools/bench/plugin-ipc-prod.runner.js`).
- **In‑process IPC** is ~60× faster than HTTP; prefer it for latency-sensitive
  communication between plugins hosted in the same Node instance.
- **WebSocket tokens** should be validated once per connection and cached on the
  socket object to avoid repeated JWT verification.
- **Rate limiting** is applied per-API prefix; adjust `rateLimitWindow` and
  `rateLimitMax` for high-traffic endpoints and use dedicated buckets for
  auth-related paths.

---

## 6. Benchmarking & CI

- Benchmarks live under `src/benchmarks/` and run via `npm run benchmark`.
- Add new `.benchmark.js` files alongside code under test; only these files
  are loaded when `JEST_BENCHMARK=true`.
- Integrate benchmarks into CI by running them nightly and comparing against a
  baseline file (`build/stats.json`). Failure to meet thresholds should block
  merges.
- Use `tools/bench/plugin-ipc-prod.runner.js` for ad‑hoc HTTP stress testing
  outside of Jest; it simulates I/O latency and records results when
  `BENCH_RECORD=true`.

---

## 7. General Guidelines

1. **Measure before optimizing.** Use the built-in timing middleware or
   external profilers (Clinic.js, 0x) to identify real bottlenecks.
2. **Prefer async/await** over callback hell; avoid blocking the event loop.
3. **Keep dependency graphs flat.** Large `require()` trees slow startup and
   increase memory usage; lazily import modules inside handlers when
   possible.
4. **Log judiciously.** High‑volume paths should avoid expensive string
   interpolation; use structured logging or sample one in ten requests.
5. **Environmental awareness.** Features like compression, rate limit, and
   Node-RED should be disabled in CI for consistent benchmarks.

---

Following these patterns will help maintain predictable performance as the
project grows.  When in doubt, add benchmarks or load tests and review the
results before committing changes.
