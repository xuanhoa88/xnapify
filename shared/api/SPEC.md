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
| 2 | `providers` | `providers({ container })` | Bind DI services via `container.bind()` |
| 3 | `migrations` | `migrations()` → `require.context` | Create/alter database schema (declarative) |
| 4 | `models` | `models()` → `require.context` | Load Sequelize model factories |
| 5 | `seeds` | `seeds()` → `require.context` | Populate initial data (declarative) |

> **Dynamic Model Injection**: During Phase 4, the core model factories are passed the DI `container`. They emit a `[PascalCaseModelName]:define` hook (e.g. `hook('models').invoke('User:define', { attributes, container })`) right before executing `connection.define`. This allows extensions (binding early in Phase 2 `providers`) to safely slip new attributes into the schema before it seals. Furthermore, they emit a `[PascalCaseModelName]:associate` hook at the end of their `associate` definitions, allowing dynamic relational binding (e.g., `User.hasMany(...)`).
| 6 | `boot` | `boot({ container })` | Hook registration, workers, schedulers |
| 7 | `routes` | `routes()` → `require.context` | Expose file-based API routes |

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

| Engine | Container Key | Description |
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
| `search` | `search` | **Module-provided** — see `src/apps/search` (database FTS) |
| `template` | `template` | LiquidJS template rendering |
| `webhook` | `webhook` | **Module-provided** — see `src/apps/webhooks` |

## Dependencies

- **Sequelize** — ORM, migrations, model definition
- **LiquidJS** — Template rendering
- **node-cron** — Task scheduling
- **crypto** — HMAC signature verification (Node.js built-in)
