# Bootstrap AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Bootstrap layer at `src/bootstrap`.
> This layer orchestrates the application startup: registering engines, running migrations, discovering modules, and assembling both the API router and the client-side view router.

---

## Objective

Provide the startup orchestration for both server-side API and client-side views. The bootstrap layer discovers application modules, registers shared engines on the DI container, applies global middleware, and builds the dynamic routers.

## 1. Architecture

```
src/bootstrap/
├── api/
│   ├── index.js          # API bootstrap function (5-step startup)
│   └── middlewares/
│       ├── cors.js       # CORS middleware (env-configurable)
│       └── logging.js    # Morgan logging middleware
└── views.js              # View router bootstrap (AppRouter + module discovery)
```

### Dependency Graph

```
api/index.js
├── express
├── @shared/api (discoverModules, engines)
├── @shared/api/router (DynamicRouter)
├── @shared/api/engines/auth (refreshToken, optionalAuth)
└── middlewares/cors.js, middlewares/logging.js

views.js
├── @shared/renderer/autoloader (discoverModules)
├── @shared/renderer/redux (features, rootReducer)
└── @shared/renderer/router (Router)
```

## 2. API Bootstrap (`api/index.js`)

### `bootstrap(app) → Promise<Router>`

Orchestrates the full API startup sequence:

```
1. registerEngines(container)    — Register all engines on DI container
2. configurePassport()           — Setup OAuth registry
3. runCoreMigrations()           — Run DB migrations + seeds
4. setupGlobalMiddleware(app)    — Apply morgan + CORS
5. setupApiRoutes(app)           — Discover modules + build router
```

### `registerEngines(container)`

Iterates `engines` from `@shared/api` and registers each on the DI container via `container.instance(name, engine)`.

- If engine has `withContext(container)` → binds engine to the DI container (enables `container.resolve()` within engine).
- Otherwise → registers engine directly.
- Exports `APP_PROVIDERS` — array of engine names (`Object.keys(engines)`).

### `runCoreMigrations()`

If `engines.db.connection` exists, runs `runMigrations()` then `runSeeds()`.

### `setupGlobalMiddleware(app)`

Applies globally (to all requests, not just API):

1. **Morgan logging** — `dev` format in `__DEV__`, `combined` in production.
2. **CORS** — configurable via `XNAPIFY_CORS_ORIGIN` env var.

### `createApiMiddlewareStack(app) → middleware[]`

Applied to every API route (before each DynamicRouter):

1. `auth.middlewares.refreshToken()` — auto-refresh tokens.
2. `auth.middlewares.optionalAuth()` — populate `req.user` if token present.

Only applied if `container.resolve('jwt')` is available.

### `buildApiRouter(app, apiRoutes) → express.Router`

1. Creates `express.Router()`.
2. Applies body parsing scoped to API routes:
   - `express.json({ limit: XNAPIFY_JSON_BODY_LIMIT || '10mb' })`
   - `express.urlencoded({ extended: true, limit: XNAPIFY_URLENCODED_BODY_LIMIT || '1mb' })`
3. For each discovered module → creates `DynamicRouter(adapter)` and mounts with API middleware stack.

### Module Discovery

```javascript
require.context('../../apps', true, /^\.\/[^/]+\/api\/index\.[cm]?[jt]s$/i);
```

Discovers `src/apps/*/api/index.js` files. Each module goes through the lifecycle: `translations → providers → migrations → models → seeds → boot → routes`.

## 3. View Router Bootstrap (`views.js`)

### `initializeRouter(options?) → Promise<AppRouter>`

| Option      | Description                                |
| ----------- | ------------------------------------------ |
| `extension` | Extension manager instance (client or server) |
| `container` | DI container instance                      |

### Module Discovery

```javascript
require.context('../apps', true, /^\.\/[^/]+\/views\/index\.[cm]?[jt]s$/i);
```

Discovers `src/apps/*/views/index.js` files. Each module goes through the lifecycle: `translations → providers → boot → routes`.

### `AppRouter` (extends `Router`)

Overrides `resolve(context)` to handle metadata:

- If page has no `description` → falls back to app description from Redux state.
- If page has `title` → suffixes with ` - {AppName}`.
- If page has no `title` → uses `{AppName}` as title.

### Router Configuration

| Feature          | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| `errorHandler`   | In `__DEV__`: throws non-403 errors. In prod: redirects to `/error` route. |
| `onRouteInit`    | Loads extension namespace for the route (if not already loaded).              |
| `onRouteDestroy` | Unloads extension namespace for the route.                                    |
| Catch-all        | `/*path` → redirects to `/not-found` route.                                |

Extension namespace is derived from: `route.workspace` → `route.module.workspace` → `route.path`.

## 4. CORS Middleware (`api/middlewares/cors.js`)

### `createCorsMiddleware() → Express middleware`

Uses the `cors` package with dynamic origin resolution.

### `XNAPIFY_CORS_ORIGIN` Env Var

| Value                | Behavior                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `'true'`             | Allow all origins (⚠️ dev only)                                   |
| `'false'`            | Block all origins                                                 |
| comma-separated URLs | Whitelist (exact match + wildcard `*` support)                    |
| unset/empty          | Same-host fallback (allows only requests from same `Host` header) |

**Features:**

- Requests with no origin (mobile apps, curl) always allowed.
- Wildcard support: `https://*.example.com` matches subdomains.
- `credentials: true` — allows cookies/auth headers.
- `maxAge: 86400` — caches preflight for 24 hours.

## 5. Logging Middleware (`api/middlewares/logging.js`)

### `createLoggingMiddleware() → Express middleware`

Morgan request logging:

- `__DEV__` → `'dev'` format (colored, concise).
- Production → `'combined'` format (Apache combined log).

## 6. Environment Variables

| Var                         | Default   | Description            |
| --------------------------- | --------- | ---------------------- |
| `XNAPIFY_CORS_ORIGIN`           | same-host | CORS allowed origins   |
| `XNAPIFY_JSON_BODY_LIMIT`       | `'10mb'`  | JSON body parser limit |
| `XNAPIFY_URLENCODED_BODY_LIMIT` | `'1mb'`   | URL-encoded body limit |

## 7. Container-Based DI

The bootstrap layer uses the DI container (`app.get('container')`) as the single service registry:

- `container.instance(name, value)` — registers a service.
- `container.resolve(name)` — retrieves a service.
- Engines with `withContext(container)` receive the container for internal service resolution.

Modules and engines never access Express `app` methods (`app.use`, `app.set`) directly.

---

_Note: This spec reflects the CURRENT implementation of the bootstrap layer._
