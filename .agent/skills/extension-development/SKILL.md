---
name: extension-development
description: Extend the extension and hook systems with slots, hooks, and API endpoints without modifying core code.
---

# Extension Developer Skill

This skill equips you to build entirely encapsulated extensions for the `xnapify` application using the Extension Manager registry and event hooks.

## Core Concepts

Unlike Modules (which contain core domain logic), Extensions (`src/extensions/`) are isolated and modify behavior dynamically via Extension Slots and Event Hooks. They are loaded and unloaded during runtime via the Extension Manager.

> **Important Activation Rule:** All extensions (including local development plugins in `src/extensions/`) MUST be registered in the database with `is_active: true` to be discovered and loaded via the API. Building the web app or dragging a folder into the source tree will NOT magically auto-activate an extension without database correlation.

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

   **Modifying Core DB Models (Dynamic Model Injection):**
   Extensions can inject columns into core models (like `User` or `Setting`) securely *before* the models are constructed by subscribing to their `define` hook during the `providers()` phase:
   ```javascript
   export async function providers({ container }) {
     const hook = container.resolve('hook');
     // The core framework emits [PascalCaseModelName]:define
     hook('models').on('User:define', async ({ attributes, DataTypes }) => {
       attributes.my_plugin_field = { type: DataTypes.STRING, allowNull: true };
     });
   }
   ```
   *Note: Ensure your extension's migrations actually alter the core database table to support your new field!*

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

| Service Key   | Type           | Description                                                                                  |
| ------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `hook`        | `Function`     | Event hook engine — `.emit` (PubSub) or `.invoke` (Pipeline)                                 |
| `email`       | `EmailManager` | Low-level email engine (direct provider access)                                              |
| `emails:send` | `Function`     | High-level templated email service with base variables                                       |
| `models`      | `Object`       | Sequelize model registry — `container.resolve('db').models` or `container.resolve('models')` |
| `db`          | `Object`       | Database connection and migration runner                                                     |

### Sending Emails from Extensions

Extensions should use the `emails:send` hook (preferred) or resolve `emails:send` from the container:

**Option 1: Hook API (recommended)**

```javascript
// In boot()
const hook = container.resolve('hook');

await hook('emails').emit('send', {
  slug: 'order-confirmation', // DB template slug (optional)
  to: 'customer@example.com', // required — valid email
  subject: 'Order #{{ orderId }}', // fallback subject
  html: '<p>Hi {{ name }}</p>', // fallback HTML (required if no slug)
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

| Constant           | Value                                                         | Use For                                                                           |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
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
      registry.createPipeline(async ctx => {
        ctx.result = await computeHash(ctx.data.filePath);
      }),
      __EXTENSION_ID__,
    );
  },

  shutdown({ container, registry }) {
    registry.unregisterHook(
      `ipc:${__EXTENSION_ID__}:compute-hash`,
      __EXTENSION_ID__,
    );
    // ... also unregister hooks, slots, etc.
  },
};
```

## Settings UI Integration

Extensions that add global configurations to the `Setting` table automatically receive a tab in the `/admin/settings` UI. To customize the appearance of this tab (icons, localization, field ordering), extensions should register a frontend config hook:

```javascript
// views/index.js
export default {
  translations() {
    return require.context('../translations', false, /\.json$/i);
  },

  boot({ registry }) {
    // Inject tab metadata using the exact namespace inserted into the DB
    registry.registerHook('settings.tabs.config', () => ({
      my_extension: {
        icon: '/api/extensions/my_extension/static/icon.svg', // Serves static asset
        i18nKey: 'my_extension:settings.tabLabel', // Uses your translations()
        label: 'My Extension', // Fallback
        order: 60,
        fieldOrder: ['API_KEY', 'WEBHOOK_URL'],
      },
    }));
  },

  shutdown({ registry }) {
    // Always cleanup!
    registry.unregisterHook('settings.tabs.config');
  },
};
```

---

## Critical Requirements

- NEVER directly modify `src/apps/` files from an extension.
- Ensure every event listener registered in `boot` is explicitly cleaned up in `shutdown`. Memory leaks will crash the hot-reloading pipeline.
- Make all database interactions within `install/uninstall` defensively coded (`try/catch`), as they execute during sensitive state transitions.
- Use `providers()` for Redux reducer injection — NOT `boot()`. The store is only available after `runProviders()`.
- **i18n & Localization:** Extracted strings and `translations/en-US.json` MUST be used. Do not hardcode raw strings into extension components or API responses.

---

## Related Skills & Workflows

| Need                       | Skill / Workflow                                       |
| -------------------------- | ------------------------------------------------------ |
| Core module patterns       | `module-development` skill                             |
| Coding standards           | `coding-standards` skill                               |
| Security review            | `security-compliance` skill                            |
| Code review checklist      | `code-review` skill (`checklists/extension-review.md`) |
| Adding extension tests     | `/add-test` workflow                                   |
| Full extension scaffolding | `/add-extension` workflow                              |
| Database patterns          | `database-development` skill                           |
| Engine development         | `engine-development` skill                             |

## Content-Hashed Bundles & Cache Busting

### Build Output

Extension builds emit **content-hashed filenames** for all bundles to prevent browser and Node.js caching issues. Each extension's build directory contains:

```
build/extensions/<ext_name>/
├── api.a1b2c3d4.js              # API module (content-hashed)
├── browser.e5f6a7b8.js          # Browser entry (content-hashed)
├── remote.c9d0e1f2.js           # Module Federation container (content-hashed)
├── server.5e6f7a8b.js           # SSR bundle (content-hashed)
├── extension.1a2b3c4d.css       # Extracted CSS (content-hashed)
├── stats.json                # Maps logical → physical filenames
└── package.json                 # Manifest with hashed entry points
```

### stats.json

The `BuildManifestPlugin` (in `extension.config.js`) writes a `stats.json` after each successful compilation. This file maps logical bundle names to their content-hashed physical filenames:

```json
{
  "api.js": "api.5629519e.js",
  "server.js": "server.51f6e08d.js",
  "extension.css": "extension.378c9da8.css",
  "remote.js": "remote.a475718a.js",
  "browser.js": "browser.02cddc19.js",
  "builtAt": 1775210463949
}
```

### How Runtime Resolution Works

1. **Server (`ServerExtensionManager`)**: `readManifest()` loads `stats.json` alongside `package.json`. All bundle paths (`_loadViewModule`, `_requireApiModule`, `_onExtensionLoaded`) resolve through this manifest.
2. **Client (`ClientExtensionManager`)**: The manifest's `buildManifest` object is passed to the client via the extension API response. CSS/script injection and MF container loading use hashed filenames directly.
3. **Static serving**: `serveExtensionStatic()` detects content-hashed files by pattern (`*.<8-char-hex>.*`) and sets `Cache-Control: public, max-age=31536000, immutable`. Non-hashed files get `Cache-Control: no-cache`.

### Debugging with Hashed Filenames

When debugging extension bundles in development:

1. **Find the physical filename**: Check `build/extensions/<ext_name>/stats.json` to map logical names (e.g. `api.js`) to hashed filenames (e.g. `api.5629519e.js`).
2. **Browser DevTools**: In the Network tab, look for requests like `/api/extensions/<id>/static/remote.a475718a.js` — the hash in the URL is the cache buster.
3. **Source maps**: Source maps are generated alongside hashed bundles and can be loaded in DevTools for step-through debugging.
4. **Rebuild detection**: After modifying extension source code, the watcher rebuilds and generates new hashes. The dev server automatically refreshes extensions via the `extensions-refreshed` IPC message.

### Important Notes

- **All extensions must be rebuilt** after upgrading to content-hashed builds. Legacy extensions without `stats.json` will fail to load.
- Hashes change on **every rebuild** when content changes — this is by design for cache safety.
- The `package.json` `main` and `browser` fields contain the hashed filenames (e.g. `"main": "./api.5629519e.js"`).
