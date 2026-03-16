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
    ├── search/         # Full-text search (memory, database FTS)
    ├── template/       # LiquidJS template rendering
    ├── webhook/        # Inbound webhook handler with HMAC verification
    └── worker/         # Piscina-based worker thread pools
```

## Components

### 1. Engine Auto-Discovery (`index.js`)

Scans `./engines/*/index.js` via webpack `require.context` and builds a frozen object of engine interfaces.

| Export | Type | Description |
|---|---|---|
| `engines` | `Object` | Frozen map of all discovered engines |
| Named exports | `*` | Each engine as `import { db, auth } from '@shared/api'` |

**Discovery logic:**
- Loads `./engines/{name}/index.js`
- Prefers `default` export as base object
- Merges non-conflicting named exports onto the base
- Freezes the result to prevent runtime mutation

### 2. Module Autoloader (`autoloader.js`)

Discovers and boots API modules in deterministic lifecycle order.

#### Lifecycle Phases (sequential)

| # | Phase | Hook Signature | Purpose |
|---|---|---|---|
| 1 | `translations` | `translations()` → `require.context` | Register i18n namespaces |
| 2 | `models` | `models()` → `require.context` | Load Sequelize model factories |
| 3 | `providers` | `providers(app)` | Bind DI services, `app.set()` |
| 4 | `migrations` | `migrations(app)` | Create/alter database schema |
| 5 | `seeds` | `seeds(app)` | Populate initial data |
| 6 | `init` | `init(app)` | Hook registration, workers, schedulers |
| 7 | `routes` | `routes()` → `require.context` | Expose file-based API routes |

#### Module Loading Order

1. Core modules (ordered): `permissions`, `roles`, `groups`, `users`, `auth`, `files`, `plugins`
2. Additional core from `RSK_MODULE_DEFAULTS` env
3. Remaining modules alphabetically

#### Error Handling

- Non-core module errors are collected but don't abort startup
- Core module errors throw `InvalidCoreModulesError` and halt the app

### 3. Router (`router/`)

File-based radix-tree router that maps filesystem paths to HTTP handlers.

#### File Conventions

| Pattern | Meaning |
|---|---|
| `_route.js` | Route handler (exports `get`, `post`, `put`, etc.) |
| `_config.js` | Route configuration (auth, rate limiting) |
| `_middleware.js` | Middleware applied to route and children |
| `(name)/` | Route group (not in URL path) |
| `[param]/` | Dynamic segment → `:param` |

#### Route Module Exports

```javascript
// Method handlers
export function get(req, res, next) { }
export function post(req, res, next) { }
export const put = [middleware1, handler]; // Array = middleware chain

// Special exports
export const middleware = false;           // Disable inherited middleware
export function init({ app }) { }         // One-time route init
export function mount({ app, path }) { }  // Called per-request
```

#### Adapter Interface

Virtual adapters can be added via `router.add(adapter)`:

```javascript
const adapter = {
  files() { return ['./path/_route.js']; },
  load(filePath) { return { get(req, res) { }, middleware: false }; },
};
router.add(adapter);
```

## Engines Reference

| Engine | `app.set()` Key | Description |
|---|---|---|
| `auth` | `auth` | JWT sessions, OAuth, permission middleware |
| `cache` | `cache` | Key-value store (memory/file), auto-disabled in dev |
| `db` | `db` | Sequelize connection, migrator, model registry |
| `email` | `email` | Email delivery with template rendering |
| `fs` | `fs` | File upload/download with provider abstraction |
| `hook` | `hook` | Channel-based pub/sub hooks (`hook('users').on(...)`) |
| `http` | `http` | Request/response helpers, error classes |
| `queue` | `queue` | Background job queue with retry/backoff |
| `schedule` | `schedule` | Cron-based task scheduling |
| `search` | `search` | Full-text search (memory FTS / database FTS5) |
| `template` | `template` | LiquidJS template rendering |
| `webhook` | `webhook` | Inbound webhook handler with HMAC verification |
| `worker` | `worker` | Piscina-based worker thread pools |

## Dependencies

- **Sequelize** — ORM, migrations, model definition
- **Piscina** — Worker thread pools
- **LiquidJS** — Template rendering
- **node-cron** — Task scheduling
- **crypto** — HMAC signature verification (Node.js built-in)
