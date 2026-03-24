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

- **`onLoad(context)`**: Called immediately after extension code is loaded. Context is `{}` (empty) at boot-time.
- **`translations()`**: Declarative — returns a `require.context` for i18n JSON files. Auto-registered before other hooks.

### Post-bootstrap Hooks (full DI context: `{ container, store }`)

After `runProviders()` is called (during SSR or client bootstrap), lifecycle hooks receive the full DI context:

- **`providers(registry, context)`**: Called once per request (SSR) or once at boot (client). Use to inject Redux reducers or other per-request setup. Context includes `{ container, store }`.
- **`init(registry, context)`**: Re-runs on every server boot. Register IPC handlers, subscribe to hooks. Context includes `{ container, store }`.
- **`destroy(registry, context)`**: Re-runs when disabled. MUST unsubscribe from all hooks. Context includes `{ container, store }`.

### One-time Hooks (backend only)

- **`install(registry, context)`**: Runs ONCE when installed. Run migrations/seeds.
- **`uninstall(registry, context)`**: Runs ONCE when deleted. Revert migrations/seeds.

## Extension Kinds

### Plugin-kind (no `views()` hook)
- Extends existing modules (e.g., profile enhancements)
- Must declare `rsk.subscribe` in `package.json` with route paths
- Injects UI via slots and hooks

### Module-kind (with `views()` hook)
- Provides its own view routes
- Namespace auto-derived from `views()` return tuple `[moduleName, context]`
- Can inject Redux reducers via `providers()` hook

## Procedure: Developing an Extension

1. **Directory Structure:** Create `src/extensions/[extension-name]/`. Subdirectories include `api/`, `views/`, and `translations/`.

2. **Backend Entry (`api/index.js`):**

   - Export an object containing `translations`, `install`, `init`, `uninstall`, and `destroy`.
   - **`install(registry, context)`**: Runs ONCE when installed. Execute initial migrations/seeds.
   - **`init(registry, context)`**: Re-runs on every server boot. Register IPC handlers (`registry.registerHook`) and subscribe to core Backend Hooks (`context.container.resolve('hook')('domain').on('action', handler)`).
   - **`uninstall(registry, context)`**: Runs ONCE when deleted. Undo migrations/seeds.
   - **`destroy(registry, context)`**: Re-runs when disabled. MUST unsubscribe from all hooks (`.off()`). Use a `Symbol('handlers')` object to store function references so you can pass the exact reference to `.off()`.

3. **Frontend Entry (`views/index.js`):**

   - Export an object containing `translations`, `providers`, `init`, and `destroy`.
   - **`providers(registry, context)`**: Use `context.store.injectReducer(name, reducer)` to inject Redux state. Called once per bootstrap (before routes render).
   - **`init(registry)`**: Use `registry.registerSlot('extension.point', Component)` to inject UI. Use `registry.registerHook` to inject validation schema extenders or data middleware.
   - **`destroy(registry)`**: MUST exactly inverse `init` with `unregisterSlot` and `unregisterHook`.

4. **IPC Pipelines:**
   To allow the frontend to communicate securely with the backend, use IPC pipelines.
   - Backend: `registry.registerHook('ipc:extension-name:action', registry.createPipeline(...middlewares, handler))`
   - Frontend: `dispatch(executeIpc('extension-name:action', payload))` (or via `useExtensionHooks`)

## Router Connection (Plug & Play)

Extension API and view routes are connected symmetrically:

- **`connectApiRouter(router)`**: Called once at boot from `bootstrap/api`. Flushes buffered API routes.
- **`connectViewRouter(router)`**: Called per-request from `bootstrap/views`. Flushes buffered view routes.

Both use the shared `_connectRouter(routerKey, router)` method internally. Routes buffered during `init()` (before routers exist) are drained and injected when the router connects.

## Critical Requirements

- NEVER directly modify `src/apps/` files from an extension.
- Ensure every event listener registered in `init` is explicitly cleaned up in `destroy`. Memory leaks will crash the hot-reloading pipeline.
- Make all database interactions within `install/uninstall` defensively coded (`try/catch`), as they execute during sensitive state transitions.
- Use `providers()` for Redux reducer injection — NOT `init()`. The store is only available after `runProviders()`.
