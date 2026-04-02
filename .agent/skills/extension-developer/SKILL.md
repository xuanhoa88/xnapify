---
name: extension-developer
description: Extend the extension and hook systems with slots, hooks, and API endpoints without modifying core code.
---

# Extension Developer Skill

This skill equips you to build entirely encapsulated extensions for the `xnapify` application using the Extension Manager registry and event hooks.

## Core Concepts

Unlike Modules (which contain core domain logic), Extensions (`src/extensions/`) are isolated and modify behavior dynamically via Extension Slots and Event Hooks. They are loaded and unloaded during runtime via the Extension Manager.

## Extension Lifecycle

Extensions follow a well-defined phase-sequential lifecycle. Each phase runs for **all extensions** before the next phase begins, ensuring cross-extension dependencies are resolved.

### Phase-Sequential Activation Order

**View-side** (`activateViewNamespace`): `translations → providers → boot → routes`
**API-side** (`_performActivate`): `translations → providers → migrations → models → seeds → boot → routes`

### Boot-time Hooks (no DI context)

- **`translations()`**: Declarative — returns a `require.context` for i18n JSON files. Auto-registered via `addNamespace()` before other hooks. Cleaned up via `removeNamespace()` on deactivation.

### Post-bootstrap Hooks (full DI context: `{ container, store }`)

- **`providers({ container })`**: Called once per bootstrap (client) or once per request (SSR). Use to inject Redux reducers or other per-load setup.
- **`boot({ container, registry })`**: Re-runs on every server boot. Register IPC handlers, subscribe to hooks. Data layer (migrations, models, seeds) is already processed before this runs. 
- **`shutdown({ container, registry })`**: Called on deactivation. MUST unsubscribe from all hooks. Extension models are auto-unregistered from the `ModelRegistry`. 

### One-time Hooks (backend only)

- **`install({ container })`**: Runs ONCE when installed. Run migrations/seeds.
- **`uninstall({ container })`**: Runs ONCE when deleted. Revert migrations/seeds.

## Extension Kinds

### Plugin-kind (no `routes()` hook)
- Extends existing modules (e.g., profile enhancements)
- Subscribe to route paths via `defineExtension()` configuration (e.g., `["/profile"]`)
- Injects UI via slots and hooks

> **Note:** Module-kind extensions auto-subscribe to the `'*'` wildcard namespace. Plugin-kind extensions should configure target routes via `defineExtension()`.

### Module-kind (with `routes()` hook)
- Provides its own view routes
- Namespace auto-derived from `routes()` return tuple `[moduleName, context]`
- Can inject Redux reducers via `providers()` hook

## Procedure: Developing an Extension

1. **Directory Structure:** Create `src/extensions/[extension-name]/`. Subdirectories include `api/`, `views/`, and `translations/`.

2. **Backend Entry (`api/index.js`):**

   - Export an object containing lifecycle hooks and declarative hooks.

   **Declarative Hooks (auto-processed by the framework):**
   - **`models()`**: Returns a `require.context` for model factories. Models are auto-registered into the global `ModelRegistry` via `discover()`. No manual registration needed.
   - **`migrations()`**: Returns a `require.context` for migration files. Auto-run with `__EXTENSION_ID__` prefix (idempotent).
   - **`seeds()`**: Returns a `require.context` for seed files. Auto-run with `__EXTENSION_ID__` prefix (idempotent).
   - **`translations()`**: Returns a `require.context` for i18n JSON files.

   **Lifecycle Hooks:**
   - **`install({ container })`**: Runs ONCE when installed. Currently a no-op since migrations/seeds are now declarative.
   - **`boot({ container, registry })`**: Re-runs on every server boot. Register IPC handlers and subscribe to Backend Hooks. Models, migrations, and seeds are already processed before this runs.
   - **`uninstall({ container })`**: Runs ONCE when deleted. Undo migrations/seeds via `db.connection.revertSeeds()`/`revertMigrations()`.
   - **`shutdown({ container, registry })`**: Called on deactivation. MUST unsubscribe from all hooks (`.off()`). Extension models are auto-unregistered from the `ModelRegistry`. Translations are auto-cleaned via `removeNamespace()`.

3. **Frontend Entry (`views/index.js`):**

   - Export an object containing `translations`, `providers`, `boot`, and `shutdown`.
   - **`providers({ container })`**: Use `store.injectReducer(name, reducer)` to inject Redux state. Called once per bootstrap (before routes render).
   - **`boot(registry)`**: Use `registry.registerSlot('extension.point', Component)` to inject UI. Use `registry.registerHook` to inject validation schema extenders or data middleware.
   - **`shutdown(registry)`**: MUST exactly inverse `boot` with `unregisterSlot` and `unregisterHook`.

4. **IPC Pipelines:**
   To allow the frontend to communicate securely with the backend, use IPC pipelines.
   - Backend: `registry.registerHook('ipc:${__EXTENSION_ID__}:action', registry.createPipeline(...middlewares, handler), __EXTENSION_ID__)`
   - Frontend: `context.fetch('/api/extensions/${__EXTENSION_ID__}/ipc', { method: 'POST', body: { action, data } })`

## Router Connection (Plug & Play)

Extension API and view routes are connected symmetrically:

- **`connectApiRouter(router)`**: Called once at boot from `bootstrap/api`. Flushes buffered API routes.
- **`connectViewRouter(router)`**: Called per-request from `bootstrap/views`. Flushes buffered view routes.

Both use the shared `_connectRouter(routerKey, router)` method internally. Routes buffered during `boot()` (before routers exist) are drained and injected when the router connects.

## Namespace Activation (View-side only)

- **`activateViewNamespace(ns)`**: Activates all extensions for a namespace (translations → providers → boot → register)
- **`deactivateViewNamespace(ns)`**: Deactivates all extensions (shutdown → removeNamespace → unregister)
- **`ensureViewNamespaceActive(ns)`**: Activates only if not already active
- **`isViewNamespaceActive(ns)`**: Checks if namespace is currently active

These are exclusively view-side (lazy, per-route activation). API-side routes are static and loaded once at boot via `activateExtension()`/`deactivateExtension()`.

## Available Container Services

Extensions can resolve these services from the DI container in `boot()`:

| Service Key | Type | Description |
|---|---|---|
| `hook` | `Function` | Event hook engine — `hook('namespace').on('event', handler)` |
| `email` | `EmailManager` | Low-level email engine (direct provider access) |
| `emails:send` | `Function` | High-level templated email service with base variables |
| `models` | `Object` | Sequelize model registry — `container.resolve('db').models` or `container.resolve('models')` |
| `db` | `Object` | Database connection and migration runner |

### Sending Emails from Extensions

Extensions should use the `emails:send` hook (preferred) or resolve `emails:send` from the container:

**Option 1: Hook API (recommended)**

```javascript
// In boot()
const hook = container.resolve('hook');

await hook('emails').emit('send', {
  slug: 'order-confirmation',          // DB template slug (optional)
  to: 'customer@example.com',          // required — valid email
  subject: 'Order #{{ orderId }}',     // fallback subject
  html: '<p>Hi {{ name }}</p>',        // fallback HTML (required if no slug)
  data: { name: 'John', orderId: 42 }, // template variables (plain object)
});
```

**Option 2: Direct service (if you need return value or more control)**

```javascript
const sendTemplatedEmail = container.resolve('emails:send');

await sendTemplatedEmail(
  'order-confirmation',
  { to: 'customer@example.com', subject: 'Order', html: '<p>Fallback</p>' },
  { name: 'John', orderId: 42 },
);
```

**Base variables** (`appName`, `loginUrl`, `resetUrl`, `supportUrl`, `now`, `year`) are auto-injected into every email. If `slug` matches an active `EmailTemplate` in the database, the DB template overrides the inline fallbacks.

**Validation (hook API):** The `emails:send` hook validates `to` (valid email), `slug` (lowercase alphanumeric with hyphens), and requires either `html` or `slug`. Invalid payloads are silently skipped with `console.warn`.

## Extension Identity

Webpack injects a single compile-time constant for each extension:

| Constant | Value | Use For |
|---|---|---|
| `__EXTENSION_ID__` | `snakeCase(manifest.name)` (e.g. `xnapify_extension_profile`) | Everything: IPC hook IDs, URL paths, i18n namespaces, logging, migration prefixes |


## Worker Functions in Extensions

Extensions can use worker functions for processing tasks. Worker functions run same-process via direct imports — no pool abstraction needed.

### Pattern: Direct Worker Functions

```javascript
// api/workers/index.js
import { PROCESS_DATA } from './processor.worker';
import { COMPUTE_HASH } from './hash.worker';

export async function processData(input) {
  return await PROCESS_DATA({ input });
}

export async function computeHash(filePath) {
  return await COMPUTE_HASH({ filePath });
}
```

### Lifecycle Wiring

```javascript
// api/index.js
export default {
  boot({ container, registry }) {
    const { computeHash } = require('./workers');

    // Use worker function in IPC handler
    registry.registerHook(
      `ipc:${__EXTENSION_ID__}:compute-hash`,
      registry.createPipeline(async (ctx) => {
        ctx.result = await computeHash(ctx.data.filePath);
      }),
      __EXTENSION_ID__,
    );
  },

  shutdown({ container, registry }) {
    registry.unregisterHook(`ipc:${__EXTENSION_ID__}:compute-hash`, __EXTENSION_ID__);
    // ... also unregister hooks, slots, etc.
  },
};
```

---

## Critical Requirements

- NEVER directly modify `src/apps/` files from an extension.
- Ensure every event listener registered in `boot` is explicitly cleaned up in `shutdown`. Memory leaks will crash the hot-reloading pipeline.
- Make all database interactions within `install/uninstall` defensively coded (`try/catch`), as they execute during sensitive state transitions.
- Use `providers()` for Redux reducer injection — NOT `boot()`. The store is only available after `runProviders()`.

---

## Related Skills & Workflows

| Need | Skill / Workflow |
|------|-----------------|
| Core module patterns | `module-developer` skill |
| Coding standards | `clean-code` skill |
| Security review | `security-auditor` skill |
| Code review checklist | `code-reviewer` skill (`checklists/extension-review.md`) |
| Adding extension tests | `/add-test` workflow |
| Full extension scaffolding | `/add-extension` workflow |
| Database patterns | `database-developer` skill |
| Engine development | `engine-developer` skill |

