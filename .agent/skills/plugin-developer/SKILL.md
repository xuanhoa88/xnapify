---
name: plugin-developer
description: Extend the plugin and hook systems with slots, hooks, and API endpoints without modifying core code.
---

# Plugin Developer Skill

This skill equips you to build entirely encapsulated extensions for the `rapid-rsk` application using the Plugin Manager registry and event hooks.

## Core Concepts

Unlike Modules (which contain core domain logic), Plugins (`src/plugins/`) are isolated and modify behavior dynamically via Extension Slots and Event Hooks. They are loaded and unloaded during runtime via the Plugin Manager.

## Procedure: Developing a Plugin

1. **Directory Structure:** Create `src/plugins/[plugin-name]/`. Subdirectories include `api/`, `views/`, and `translations/`.

2. **Backend Entry (`api/index.js`):**
   - Export an object containing `translations`, `install`, `init`, `uninstall`, and `destroy`.
   - **`install(registry, context)`**: Runs ONCE when a user installs the plugin. Useful for executing initial migrations/seeds.
   - **`init(registry, context)`**: Re-runs on every server boot. Register IPC handlers (`registry.registerHook`) and subscribe to core Backend Hooks (`context.app.get('hook')('domain').on('action', handler)`).
   - **`uninstall(registry, context)`**: Runs ONCE when deleted. Undo migrations/seeds.
   - **`destroy(registry, context)`**: Re-runs when disabled. MUST unsubscribe from all hooks (`.off()`). Use a `Symbol('handlers')` object to store function references so you can pass the exact reference to `.off()`.

3. **Frontend Entry (`views/index.js`):**
   - Export an object containing `translations`, `init`, and `destroy`.
   - **`init(registry)`**: Use `registry.registerSlot('extension.point', Component)` to inject UI. Use `registry.registerHook` to inject validation schema extenders or data middleware.
   - **`destroy(registry)`**: MUST exactly inverse `init` with `unregisterSlot` and `unregisterHook`.

4. **IPC Pipelines:** 
   To allow the frontend to communicate securely with the backend plugin, use IPC pipelines.
   - Backend: `registry.registerHook('ipc:plugin-name:action', registry.createPipeline(...middlewares, handler))`
   - Frontend: `dispatch(executeIpc('plugin-name:action', payload))` (or via `usePluginHooks`)

## Critical Requirements
- NEVER directly modify `src/apps/` files from a plugin.
- Ensure every event listener registered in `init` is explicitly cleaned up in `destroy`. Memory leaks will crash the hot-reloading pipeline.
- Make all database interactions within `install/uninstall` defensively coded (`try/catch`), as they execute during sensitive state transitions.
