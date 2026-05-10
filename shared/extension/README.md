# Shared Extension

The core extension architecture for xnapify. It provides a universal Extension Registry for cross-extension communication, dependency injection, UI slots, and backend extension points (hooks), along with server-side API loading and client-side advanced Rspack Module Federation (MF).

## Quick Start

Extensions encapsulate domain-specific logic and UI.

**Backend Extensibility:**

```javascript
// Expose a hook
await registry.executeHook('users.created', { userId: 123 });

// Register to a hook
registry.registerHook('users.created', async data => {
  console.log('User created:', data.userId);
});
```

**Frontend Extensibility (UI Slots):**

```jsx
import { ExtensionSlot } from '@shared/renderer/components/Extension';

// Define a slot in the main app
export default function UserProfile() {
  return (
    <div>
      <h1>User Profile</h1>
      {/* Extensions inject React components here */}
      <ExtensionSlot name='user.profile.tabs' />
    </div>
  );
}
```

```jsx
// Register a component into the slot from a extension
registry.registerSlot('user.profile.tabs', MyCustomTabComponent, { order: 10 });
```

## Architecture

The extension system contains universal utilities, client-specific managers, and server-specific managers.

- **Registry (`utils/Registry.js`)**: Universal. Manages `slots`, `hooks`, and `definitions`. Tracks registrations per extension ID allowing for clean uninstalls and reloads without memory leaks.
- **Hook (`utils/Hook.js`)**: Universal. Executes registered callbacks sequentially (`execute`) or concurrently (`executeParallel`).
- **ClientExtensionManager (`client/manager.js`)**: Discovers extension manifests from the server, injects `extension.css` and `remote.js` tags into the DOM, and orchestrates Rspack Module Federation (`container.init` and `container.get('./extension')`) to load React code at runtime.
- **ServerExtensionManager (`server/manager.js`)**: Exposes physical filesystem resolving (`resolveExtensionDir`), reads package.json manifests natively, and loads backend extension code (`api.js`) to trigger lifecycle events (`install`, `uninstall`, `init`, `destroy`).
- **ExtensionSlot (`client/ExtensionSlot.js`)**: A React component that listens to `Registry` changes and dynamically renders arrays of components injected by extensions.

## Extension Identity

Each extension has a single compile-time identifier injected by Rspack:

- **`__EXTENSION_ID__`** — Generated at build time via `sqids(charCodes(manifest.name))` (e.g. `4ayO6ElAvIRLrgn...`). URL-safe, alphanumeric. Used for all purposes: IPC hook IDs, URL paths, i18n namespaces, logging, and migration prefixes.

## Creating a Extension

Extensions are dynamically loaded. Their capabilities are defined by entry points defined in their `package.json` (`main` for API/Server, `browser` for View/Client).

A standard extension exports an object with `init` and `destroy` methods:

```javascript
// Example Extension API (api.js or browser.js)
export default {
  async init(registry, context) {
    // Register hooks, slots, or middlewares
  },
  async destroy(registry, context) {
    // Automatic cleanup happens via the Registry,
    // but custom teardown goes here (e.g. closing DB connections)
  },
};
```

## Advanced Loading (SSR vs Client)

During Server-Side Rendering (SSR), the `ServerExtensionManager` passes the physical paths to the bundles to the React renderer ensuring extensions render synchronously.

On the client, the `ClientExtensionManager` intercepts the payload. It waits for the main application's `__webpack_share_scopes__` to initialize, injects `<script>` tags for each extension's `remote.js`, binds the Module Federation container, and executes the extension.

---

# Shared Extension — Technical Specification

## Overview

The `shared/extension/` module establishes the boundaries, lifecycle events, UI composability, and dynamic loading strategies required for developing isolated extensions that extend both the frontend and backend without modifying the core codebase.

## Directory Structure

```
shared/extension/
├── client/          # Frontend-specific implementation
│   ├── index.js     # Client exports
│   ├── ExtensionManager.js # ClientExtensionManager (Module Federation handler)
│   ├── ExtensionSlot.js# React component for dynamic rendering
│   └── useExtension.js # React hooks (useExtensionHooks, etc.)
├── server/          # Backend-specific implementation
│   └── ExtensionManager.js # ServerExtensionManager (Node.js loader)
└── utils/           # Universal isomorphic utilities
    ├── BaseExtensionManager.js # Base class with extension fetching/state logic
    ├── Hook.js      # Callback manager
    └── Registry.js  # The core state container for the extension ecosystem
```

Lifecycle phase constants are defined in `shared/utils/lifecycle.js` — the single source of truth.

## Extension Identity

Each extension has a single compile-time identifier injected by Rspack:

| Constant           | Source                                                      | Example              |
| ------------------ | ----------------------------------------------------------- | -------------------- |
| `__EXTENSION_ID__` | `sqids(charCodes(manifest.name))` — generated at build time | `4ayO6ElAvIRLrgn...` |

This is URL-safe (alphanumeric only) and used consistently for IPC hook IDs, URL paths, route params, i18n namespaces, migration prefixes, and logging.

The build pipeline generates `id` via `generateExtensionId(name)` (sqids) and writes it into the output `package.json`. The server-side `readManifest()` reads `manifest.id` directly.

## Lifecycle Phases

### API Extensions (Server)

| #   | Phase          | Description                                      |
| --- | -------------- | ------------------------------------------------ |
| 1   | `translations` | Register i18n namespaces                         |
| 2   | `providers`    | Bind DI services via `container.bind()`          |
| 3   | `migrations`   | Create/alter tables (declarative context return) |
| 4   | `models`       | Register ORM definitions                         |
| 5   | `seeds`        | Populate data (declarative context return)       |
| 6   | `boot`         | Hook registration, schedulers                    |
| 7   | `routes`       | Mount API routes                                 |

### View Extensions (Server SSR + Client)

| #   | Phase          | Description                 |
| --- | -------------- | --------------------------- |
| 1   | `translations` | Register i18n namespaces    |
| 2   | `providers`    | Bind DI services            |
| 3   | `boot`         | Module-level initialization |
| 4   | `routes`       | Inject view routes          |

## `Registry` (`utils/Registry.js`)

The `ExtensionRegistry` class acts as the central hub. It maintains state maps utilizing modern Javascript features (Sets, Maps, and Symbols) to store extension points securely.

Crucially, **every registration tracks its ownership**. When a extension calls `registry.registerSlot(...)`, the registry maps that registration to the `extensionId`. When a extension is unloaded, `_clearExtensionRegistrations(extensionId)` automatically purges the associated slots and hooks preventing severe memory leaks during Hot Module Replacement (HMR).

## `Hook` (`utils/Hook.js`)

A custom implementation of the Observer pattern explicitly designed for extensions.
It supports two primary execution strategies:

1. `execute(hookId, ...args)`: Sequential execution via `for...of`. Waits for each asynchronous hook to resolve before proceeding to the next — critical for state-mutation hooks.
2. `executeParallel(hookId, ...args)`: Concurrent execution utilizing `Promise.all()`. High performance, used for broad notifications.

## Client Extension Manager (`client/ExtensionManager.js`)

Extends `BaseExtensionManager`. It operates strictly within the browser context and handles Rspack 5 Module Federation natively.

### Execution Flow:

1. Validates the existence of `__webpack_share_scopes__`.
2. Locates the extension's `manifest` determining if `hasClientScript` exists.
3. Dynamically injects `<script src=".../remote.js">` into the DOM.
4. Pauses until the script parses, attaching a global variable representing the MF Container.
5. Injects the shared host scope via `container.init(__webpack_share_scopes__.default)`.
6. Extracts the bootstrapped module via `container.get('./extension')`.
7. Runs the full view lifecycle (`translations → providers → boot → routes`).

## Server Extension Manager (`server/ExtensionManager.js`)

Operates in Node.js and relies on standard `fs` resolution and non-rspack `require()`.

### Execution Flow:

1. Exposes logic to resolve the exact physical directory of a extension, supporting dev-mode overrides (checking `XNAPIFY_EXTENSION_LOCAL_PATH` first, then standard paths).
2. Deletes the `require` cache entry for the targeted module ensuring fresh code is loaded on HMR.
3. Loads the module cleanly utilizing `__non_webpack_require__`.
4. Runs the full API lifecycle (`translations → providers → migrations → models → seeds → boot → routes`).
5. For view modules, runs the view lifecycle (`translations → providers → boot → routes`).
6. Caches generated CSS and JS entry points to serialize into SSR HTML responses.
7. On uninstall, auto-reverts seeds and migrations using the extension's declarative contexts.
