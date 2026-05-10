# Shared API

Server-side infrastructure — engines, module autoloading, and file-based routing.

## Quick Start

```javascript
// Import engines directly
import { db, auth, hook } from '@shared/api';
```

## Engines

All engines live in `engines/` and are auto-discovered at startup. Each engine is a singleton accessible via `import` or `container.resolve('name')`.

| Engine       | Purpose                 | Example                                            |
| ------------ | ----------------------- | -------------------------------------------------- |
| **auth**     | JWT, OAuth, permissions | `auth.middlewares.requirePermission('users:read')` |
| **cache**    | Key-value store         | `await cache.set('key', value, 60000)`             |
| **db**       | Sequelize ORM           | `const { models } = container.resolve('db')`       |
| **email**    | Email delivery          | `await email.send({ to, subject, html })`          |
| **fs**       | File operations         | `await fs.upload({ fileName, buffer, mimeType })`  |
| **hook**     | Pub/sub hooks           | `hook('users').on('created', handler)`             |
| **http**     | Request/response utils  | `http.sendSuccess(res, { data })`                  |
| **queue**    | Background jobs         | `queue('emails').publish({ to, template })`        |
| **schedule** | Cron tasks              | `schedule.register('cleanup', '0 0 * * *', fn)`    |
| **template** | LiquidJS rendering      | `await template.render(html, variables)`           |

## Module Autoloader

Modules in `src/apps/` are auto-discovered and booted in order:

```
translations → models → providers → migrations → seeds → init → routes
```

Each module exports lifecycle hooks in `api/index.js`:

```javascript
export function translations() { return [import.meta.webpackContext('../translations', ...)]; }
export function models() { return import.meta.webpackContext('./models', ...); }
export async function providers(container) { container.instance('myService', service); }
export async function migrations(container) { /* run migrations */ }
export async function seeds(container) { /* seed data */ }
export async function init(container) { /* register hooks, workers */ }
export function routes() { return import.meta.webpackContext('./routes', ...); }
```

## Dynamic Model Modification

Extensions and core modules can dynamically extend core models (by injecting new columns or configuration) right before they are sealed by Sequelize. Using the `providers` phase, you can listen to the `[PascalCaseModelName]:define` hook (e.g. `User:define`):

```javascript
export async function providers({ container }) {
  const hook = container.resolve('hook');

  hook('models').on('User:define', ({ attributes, DataTypes }) => {
    // Inject a new column before `connection.define` finishes!
    attributes.my_new_field = { type: DataTypes.STRING, allowNull: true };
  });

  hook('models').on('User:associate', ({ models, model: User }) => {
    // Dynamically inject a relation to an extension model
    User.hasMany(models.MyCustomModel, {
      foreignKey: 'user_id',
      as: 'customData',
    });
  });
}
```

## File-Based Router

Routes are defined by filesystem structure under `api/routes/`:

```
api/routes/
├── (admin)/                    # Route group (stripped from URL)
│   ├── (default)/_route.js     # GET/POST /api/{module}
│   ├── list/_route.js          # GET /api/{module}/list
│   └── [id]/_route.js          # GET/PUT/DELETE /api/{module}/:id
├── _config.js                  # Config for this route tree
└── _middleware.js              # Middleware for this route tree
```

Route files export HTTP method handlers:

```javascript
// _route.js
export const middleware = false; // Opt out of inherited middleware

export function get(req, res) {
  /* handle GET */
}
export function post(req, res) {
  /* handle POST */
}
export const put = [authMiddleware, handler]; // Chain via array
```

- [router/README.md](./router/README.md) — Router details

---

# Shared API — Technical Specification

## Overview

`shared/api/` provides the server-side infrastructure for the application: engine auto-discovery, module lifecycle management, and file-based routing.

## Architecture

```
shared/api/
├── index.js            # Engine auto-discovery & named exports
├── autoloader.js       # Module lifecycle orchestrator
├── router/             # File-based radix-tree router
│   ├── index.js        # Router class (add, resolve, middleware)
│   ├── collector.js    # Route/config/middleware file collector
│   ├── builder.js      # Route tree builder
│   ├── lifecycle.js    # Route lifecycle hooks (init, mount, translations)
│   ├── matcher.js      # Radix-tree request matching
│   ├── radix.js        # Radix tree implementation
│   ├── utils.js        # Path and segment utilities
│   └── constants.js    # File-naming conventions
└── engines/            # Infrastructure services
    ├── auth/           # Authentication & OAuth
    ├── cache/          # Key-value caching (memory, file)
    ├── db/             # Sequelize ORM & migrations
    ├── email/          # Email sending with template support
    ├── fs/             # Streaming file operations (local, memory, self-host)
    ├── hook/           # Channel-based async middleware hooks
    ├── http/           # HTTP request/response utilities & error handling
    ├── queue/          # Channel-based pub/sub job queue
    ├── schedule/       # Cron-based task scheduling
    ├── template/       # LiquidJS template rendering
```

## Components

### 1. Engine Auto-Discovery (`index.js`)

Scans `./engines/*/index.js` via rspack `import.meta.webpackContext` and builds a frozen object of engine interfaces.

| Export        | Type     | Description                                             |
| ------------- | -------- | ------------------------------------------------------- |
| `engines`     | `Object` | Frozen map of all discovered engines                    |
| Named exports | `*`      | Each engine as `import { db, auth } from '@shared/api'` |

**Discovery logic:**

- Loads `./engines/{name}/index.js`
- Prefers `default` export as base object
- Merges non-conflicting named exports onto the base
- Freezes the result to prevent runtime mutation

### 2. Module Autoloader (`autoloader.js`)

Discovers and boots API modules in deterministic lifecycle order.

#### Lifecycle Phases (sequential)

| #   | Phase          | Hook Signature                                  | Purpose                                    |
| --- | -------------- | ----------------------------------------------- | ------------------------------------------ |
| 1   | `translations` | `translations()` → `import.meta.webpackContext` | Register i18n namespaces                   |
| 2   | `providers`    | `providers({ container })`                      | Bind DI services via `container.bind()`    |
| 3   | `migrations`   | `migrations()` → `import.meta.webpackContext`   | Create/alter database schema (declarative) |
| 4   | `models`       | `models()` → `import.meta.webpackContext`       | Load Sequelize model factories             |
| 5   | `seeds`        | `seeds()` → `import.meta.webpackContext`        | Populate initial data (declarative)        |

> **Dynamic Model Injection**: During Phase 4, the core model factories are passed the DI `container`. They emit a `[PascalCaseModelName]:define` hook (e.g. `hook('models').invoke('User:define', { attributes, container })`) right before executing `connection.define`. This allows extensions (binding early in Phase 2 `providers`) to safely slip new attributes into the schema before it seals. Furthermore, they emit a `[PascalCaseModelName]:associate` hook at the end of their `associate` definitions, allowing dynamic relational binding (e.g., `User.hasMany(...)`).
> | 6 | `boot` | `boot({ container })` | Hook registration, workers, schedulers |
> | 7 | `routes` | `routes()` → `import.meta.webpackContext` | Expose file-based API routes |

#### Module Loading Order

1. Core modules (ordered): `permissions`, `roles`, `groups`, `users`, `auth`, `files`, `extensions`
2. Additional core from `XNAPIFY_MODULE_DEFAULTS` env
3. Remaining modules alphabetically

#### Error Handling

- Non-core module errors are collected but don't abort startup
- Core module errors throw `InvalidCoreModulesError` and halt the app

### 3. Router (`router/`)

File-based radix-tree router that maps filesystem paths to HTTP handlers.

#### File Conventions

| Pattern          | Meaning                                            |
| ---------------- | -------------------------------------------------- |
| `_route.js`      | Route handler (exports `get`, `post`, `put`, etc.) |
| `_config.js`     | Route configuration (auth, rate limiting)          |
| `_middleware.js` | Middleware applied to route and children           |
| `(name)/`        | Route group (not in URL path)                      |
| `[param]/`       | Dynamic segment → `:param`                         |

#### Route Module Exports

```javascript
// Method handlers
export function get(req, res, next) {}
export function post(req, res, next) {}
export const put = [middleware1, handler]; // Array = middleware chain

// Special exports
export const middleware = false; // Disable inherited middleware
export function init({ app }) {} // One-time route init
export function mount({ app, path }) {} // Called per-request
```

#### Adapter Interface

Virtual adapters can be added via `router.add(adapter)`:

```javascript
const adapter = {
  files() {
    return ['./path/_route.js'];
  },
  load(filePath) {
    return { get(req, res) {}, middleware: false };
  },
};
router.add(adapter);
```

## Engines Reference

| Engine     | Container Key | Description                                                |
| ---------- | ------------- | ---------------------------------------------------------- |
| `auth`     | `auth`        | JWT sessions, OAuth, permission middleware                 |
| `cache`    | `cache`       | Key-value store (memory/file), auto-disabled in dev        |
| `db`       | `db`          | Sequelize connection, migrator, model registry             |
| `email`    | `email`       | Email delivery with template rendering                     |
| `fs`       | `fs`          | File upload/download with provider abstraction             |
| `hook`     | `hook`        | Channel-based pub/sub hooks (`hook('users').on(...)`)      |
| `http`     | `http`        | Request/response helpers, error classes                    |
| `queue`    | `queue`       | Background job queue with retry/backoff                    |
| `schedule` | `schedule`    | Cron-based task scheduling                                 |
| `search`   | `search`      | **Module-provided** — see `src/apps/search` (database FTS) |
| `template` | `template`    | LiquidJS template rendering                                |
| `webhook`  | `webhook`     | **Module-provided** — see `src/apps/webhooks`              |

## Dependencies

- **Sequelize** — ORM, migrations, model definition
- **LiquidJS** — Template rendering
- **node-cron** — Task scheduling
- **crypto** — HMAC signature verification (Node.js built-in)
