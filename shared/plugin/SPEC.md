# Shared Plugin — Technical Specification

## Overview

The `shared/plugin/` module establishes the boundaries, lifecycle events, UI composability, and dynamic loading strategies required for developing isolated plugins that extend both the frontend and backend without modifying the core codebase.

## Directory Structure

```
shared/plugin/
├── client/          # Frontend-specific implementation
│   ├── index.js     # Client exports
│   ├── manager.js   # ClientPluginManager (Module Federation handler)
│   ├── PluginSlot.js# React component for dynamic rendering
│   └── usePlugin.js # React hooks (usePluginHooks, etc.)
├── server/          # Backend-specific implementation
│   └── index.js     # ServerPluginManager (Node.js loader)
└── utils/           # Universal isomorphic utilities
    ├── BasePluginManager.js # Base class with plugin fetching/state logic
    ├── Hook.js      # Callback manager
    └── Registry.js  # The core state container for the plugin ecosystem
```

## `Registry` (`utils/Registry.js`)

The `PluginRegistry` class acts as the central hub. It maintains state maps utilizing modern Javascript features (Sets, Maps, and Symbols) to store extension points securely.

Crucially, **every registration tracks its ownership**. When a plugin calls `registry.registerSlot(...)`, the registry maps that registration to the `pluginId`. When a plugin is unloaded, `_clearPluginRegistrations(pluginId)` automatically purges the associated slots and hooks preventing severe memory leaks during Hot Module Replacement (HMR).

## `Hook` (`utils/Hook.js`)

A custom implementation of the Observer pattern explicitly designed for plugins.
It supports two primary execution strategies:
1. `execute(hookId, ...args)`: Sequential execution via `for...of`. Waits for each asynchronous hook to resolve before proceeding to the next — critical for state-mutation hooks.
2. `executeParallel(hookId, ...args)`: Concurrent execution utilizing `Promise.all()`. High performance, used for broad notifications.

## Client Plugin Manager (`client/manager.js`)

Extends `BasePluginManager`. It operates strictly within the browser context and handles Webpack 5 Module Federation natively.

### Execution Flow:
1. Validates the existence of `__webpack_share_scopes__`.
2. Locates the plugin's `manifest` determining if `hasClientScript` exists.
3. Dynamically injects `<script src=".../remote.js">` into the DOM.
4. Pauses until the script parses, attaching a global variable representing the MF Container.
5. Injects the shared host scope via `container.init(__webpack_share_scopes__.default)`.
6. Extracts the bootstrapped module via `container.get('./plugin')`.
7. Calls `plugin.init()` injecting the universal `Registry`.

## Server Plugin Manager (`server/manager.js`)

Operates in Node.js and relies on standard `fs` resolution and non-webpack `require()`.

### Execution Flow:
1. Exposes logic to resolve the exact physical directory of a plugin, supporting dev-mode overrides (checking `RSK_PLUGIN_LOCAL_PATH` first, then standard paths).
2. Deletes the `require` cache entry for the targeted module ensuring fresh code is loaded on HMR.
3. Loads the module cleanly utilizing `__non_webpack_require__`.
4. Executes explicit lifecycle methods (`installPlugin`, `uninstallPlugin`, `updatePlugin`) parsing the physical manifest and invoking the corresponding exported hooks natively for backend configuration tasks (migrations, API routes, database hooks). 
5. Caches generated CSS and JS entry points to serialize into SSR HTML responses.
