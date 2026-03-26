---
name: extension-developer
description: Extend the extension and hook systems with slots, hooks, and API endpoints without modifying core code.
---

# Extension Developer Skill

This skill equips you to build entirely encapsulated extensions for the `rapid-rsk` application using the Extension Manager registry and event hooks.

## Core Concepts

Unlike Modules (which contain core domain logic), Extensions (`src/extensions/`) are isolated and modify behavior dynamically via Extension Slots and Event Hooks. They are loaded and unloaded during runtime via the Extension Manager.

## Extension Lifecycle

Extensions follow a well-defined lifecycle with hooks that receive progressively richer context:

### Boot-time Hooks (no DI context)

- **`translations()`**: Declarative — returns a `require.context` for i18n JSON files. Auto-registered before other hooks.

### Post-bootstrap Hooks (full DI context: `{ container, store }`)

After `runProviders()` is called (during SSR or client bootstrap), lifecycle hooks receive the full DI context:

- **`providers({ container })`**: Called once per request (SSR) or once at boot (client). Use to inject Redux reducers or other per-request setup. 
- **`boot({ container, registry })`**: Re-runs on every server boot. Register IPC handlers, subscribe to hooks. Data layer (migrations, models, seeds) is already processed before this runs. 
- **`shutdown({ container, registry })`**: Re-runs when disabled. MUST unsubscribe from all hooks. Extension models are auto-unregistered from the `ModelRegistry`. 

### One-time Hooks (backend only)

- **`install({ container })`**: Runs ONCE when installed. Run migrations/seeds.
- **`uninstall({ container })`**: Runs ONCE when deleted. Revert migrations/seeds.

## Extension Kinds

### Plugin-kind (no `routes()` hook)
- Extends existing modules (e.g., profile enhancements)
- Should declare `rsk.subscribe` in `package.json` with route paths (e.g., `["/profile"]`)
- Injects UI via slots and hooks

> **Note:** The `rsk` config in `package.json` is optional. If omitted, `defineExtension()` auto-defaults to `{}`. Module-kind extensions auto-subscribe to the `'*'` wildcard namespace. Plugin-kind extensions should still declare `rsk.subscribe` to target specific routes.

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
   - **`migrations()`**: Returns a `require.context` for migration files. Auto-run with `__EXTENSION_NAME__` prefix (idempotent).
   - **`seeds()`**: Returns a `require.context` for seed files. Auto-run with `__EXTENSION_NAME__` prefix (idempotent).
   - **`translations()`**: Returns a `require.context` for i18n JSON files.

   **Lifecycle Hooks:**
   - **`install({ container })`**: Runs ONCE when installed. Currently a no-op since migrations/seeds are now declarative.
   - **`boot({ container, registry })`**: Re-runs on every server boot. Register IPC handlers and subscribe to Backend Hooks. Models, migrations, and seeds are already processed before this runs.
   - **`uninstall({ container })`**: Runs ONCE when deleted. Undo migrations/seeds via `db.connection.revertSeeds()`/`revertMigrations()`.
   - **`shutdown({ container, registry })`**: Re-runs when disabled. MUST unsubscribe from all hooks (`.off()`). Extension models are auto-unregistered from the `ModelRegistry`.

3. **Frontend Entry (`views/index.js`):**

   - Export an object containing `translations`, `providers`, `boot`, and `shutdown`.
   - **`providers({ container })`**: Use `store.injectReducer(name, reducer)` to inject Redux state. Called once per bootstrap (before routes render).
   - **`boot(registry)`**: Use `registry.registerSlot('extension.point', Component)` to inject UI. Use `registry.registerHook` to inject validation schema extenders or data middleware.
   - **`shutdown(registry)`**: MUST exactly inverse `boot` with `unregisterSlot` and `unregisterHook`.

4. **IPC Pipelines:**
   To allow the frontend to communicate securely with the backend, use IPC pipelines.
   - Backend: `registry.registerHook('ipc:extension-name:action', registry.createPipeline(...middlewares, handler))`
   - Frontend: `dispatch(executeIpc('extension-name:action', payload))` (or via `useExtensionHooks`)

## Router Connection (Plug & Play)

Extension API and view routes are connected symmetrically:

- **`connectApiRouter(router)`**: Called once at boot from `bootstrap/api`. Flushes buffered API routes.
- **`connectViewRouter(router)`**: Called per-request from `bootstrap/views`. Flushes buffered view routes.

Both use the shared `_connectRouter(routerKey, router)` method internally. Routes buffered during `boot()` (before routers exist) are drained and injected when the router connects.

## Critical Requirements

- NEVER directly modify `src/apps/` files from an extension.
- Ensure every event listener registered in `boot` is explicitly cleaned up in `shutdown`. Memory leaks will crash the hot-reloading pipeline.
- Make all database interactions within `install/uninstall` defensively coded (`try/catch`), as they execute during sensitive state transitions.
- Use `providers()` for Redux reducer injection — NOT `boot()`. The store is only available after `runProviders()`.

