# Shared Extension

The core extension architecture for xnapify. It provides a universal Extension Registry for cross-extension communication, dependency injection, UI slots, and backend extension points (hooks), along with server-side API loading and client-side advanced Rspack Module Federation (MF).

## Quick Start

Extensions encapsulate domain-specific logic and UI.

**Backend Extensibility:**

```javascript
// Collector: run every handler, keep the results that succeeded.
// A handler that throws is logged and dropped, so one bad extension
// cannot break the caller.
const results = await registry.executeHook('users.created', { userId: 123 });

// Register to a hook
registry.registerHook('users.created', async data => {
  console.log('User created:', data.userId);
});
```

**Asking one extension for an answer (IPC and similar):**

```javascript
// Claim the id. `<id>` must be this extension's own id — the scoped registry
// rejects an `ipc:` id addressed to anyone else with HandlerOwnershipError,
// so no one can answer (or squat) another extension's endpoint. A second
// extension registering here throws DuplicateHandlerError instead of
// silently winning by priority.
registry.registerHandler('ipc:<id>:ping', async (data, { req }) => 'pong');

// Call it. The handler's error reaches you instead of being swallowed.
const { handled, value } = await registry.invokeHandler(
  'ipc:<id>:ping',
  data,
  ctx,
);
if (!handled) {
  // nothing registered for this id
}
```

Pick the kind at registration, not at call time:

|                     | Collector (`Hook`)                    | Handler (`Handler`)                                                                              |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Register with       | `registerHook`                        | `registerHandler`                                                                                |
| Call with           | `executeHook` / `executeHookParallel` | `invokeHandler`                                                                                  |
| Contributors per id | Many                                  | Exactly one                                                                                      |
| Second registration | Appended, ordered by priority         | Same function: no-op (re-boot is idempotent). Different function: throws `DuplicateHandlerError` |
| On handler error    | Logged and dropped                    | Propagated to the caller                                                                         |
| Remove with         | Id **and** the callback reference     | Id alone                                                                                         |
| `{ public: true }`  | Rejected                              | Allowed (guest IPC)                                                                              |

To fail a call deliberately from an IPC handler, throw an error carrying a
`status` (400-599) and optional `code`. The gateway forwards that status and
message. Any other throw becomes a `502` with a generic message, and the
original is logged rather than returned to the caller.

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
- **ClientExtensionManager (`client/ExtensionManager.js`)**: Discovers extension manifests from the server, injects `extension.css` and `remote.js` tags into the DOM, and orchestrates Rspack Module Federation (`container.init` and `container.get('./extension')`) to load React code at runtime.
- **ServerExtensionManager (`server/ExtensionManager.js`)**: Exposes physical filesystem resolving (`resolveExtensionDir`), reads package.json manifests natively, and loads backend extension bundles to run the lifecycle phases (`translations → providers → migrations → models → seeds → boot → routes`, plus one-time `install` / `uninstall`).
- **ExtensionSlot (`shared/renderer/components/Extension`)**: A React component that listens to `Registry` changes and dynamically renders arrays of components injected by extensions.

## Extension Identity

Each extension has a single compile-time identifier injected by Rspack:

- **`__EXTENSION_ID__`** — Generated at build time via `hashids(sha256(manifest.name))` with a fixed salt (e.g. `TJO7Yw61SwQzV`). It is a pure function of the package name, so it is identical on every machine and deployment. URL-safe, alphanumeric. Used for all purposes: IPC hook IDs, URL paths, i18n namespaces, logging, and migration prefixes.

## Host Contract & Isolation

Every manifest declares the host it supports and the services it needs:

```json
{
  "name": "@acme/reports",
  "xnapify": { "version": "^2.0.0", "capabilities": ["db", "models", "hook"] }
}
```

- `version` is checked by `validateManifest()` (install/toggle) and `_assertLoadable()` (load). Incompatible packages are refused with `IncompatibleExtensionError` (422).
- Lifecycle hooks receive a **capability-scoped container** (`shared/container/scoped.js`): only declared bindings resolve, and there are no `bind`/`reset`/`cleanup` methods. Anything else throws `CapabilityDeniedError`.
- What `capabilities` grants — **grants are additive**. Every extension always receives the side-effect-free defaults (`hook`, `cache`, `http`, `template`, `i18n`); a declaration adds to that baseline instead of replacing it.

  | Declared             | Resolves                                                                                     |
  | -------------------- | -------------------------------------------------------------------------------------------- |
  | key omitted entirely | the defaults                                                                                 |
  | `[]`                 | the defaults — an empty list narrows nothing, it just declares no extras                     |
  | `["db", "models"]`   | the defaults **plus** `db` and `models` — but only for a host-vouched extension (see below)  |
  | `["users:*"]`        | the defaults plus every binding whose name starts with `users:`                              |
  | `["*"]`              | ignored unless the host trusts this extension (see below); otherwise the other entries apply |

  Three grants never come from the manifest's own word, because the manifest is the extension's own `package.json`:
  - `extension`, `jwt`, and `env` are **reserved**. They are stripped from the declared list and passed to `createScopedContainer({ deny })`, so not even a granted `'*'` resolves them.
  - `'*'` is honoured only for an extension whose id or package name the operator listed in `XNAPIFY_TRUSTED_EXTENSIONS` (comma-separated). A self-declared `'*'` from anyone else is dropped with a one-time warning, and the extension keeps its other declared capabilities.
  - The **privileged tier** — `db`, `models`, `worker`, `queue`, `schedule`, `fs`, `redis` (`PRIVILEGED_CAPABILITIES`) — is honoured only for an extension the operator trusts **or** one bundled with this host build. Everything in it either reaches user data (`users.password`, `refresh_tokens`) or runs the extension's code off-request, so a self-declared `["db"]` is the same self-grant as `["*"]`, through a smaller door. Bundled ids come from `__XNAPIFY_BUNDLED_EXTENSIONS__`, injected by the build from `src/extensions/`: those ship with the host and are covered by its review, unlike anything installed from the hub at runtime. An ungranted privileged capability is dropped with a one-time warning and the rest of the declaration still applies. A prefix grant is measured by what it covers, so `"d*"` is gated exactly like `"db"`.

    The two gates are separate predicates (`isTrustedExtension` for `'*'`, `isPrivilegedExtension` for the tier): being bundled does **not** grant `'*'`, and widening one gate must not silently widen the other.

- API route handlers of module-type extensions run under the same scope: **every** function a `_route.js` export lists — middlewares included, since they are the extension's own code — sees the scoped container via `req.app.get('container')`, `res.app.get('container')` and `req.container`. A route middleware that resolves `auth` for an RBAC check therefore has to declare `auth` in `xnapify.capabilities`.
- Lifecycle hooks receive a **scoped registry**: `registerSlot`/`registerHook` are tagged with the extension id and `unregisterSlot`/`unregisterHook` refuse registrations owned by someone else.
- `autoload` dependencies are version-checked with semver after loading; a missing or mismatched dependency fails the load.
- Shared Module Federation singletons (`react`, `react-dom`, `react-redux`, `@reduxjs/toolkit`, `i18next`, `react-i18next`, `history`) use `strictVersion`, so a remote built against another major fails loudly instead of binding to the host copy.
- On the server, view activation is permanent for the extension's lifetime (`deactivateViewNamespace` is a no-op) because one registry serves concurrent SSR requests. The client still activates and deactivates per route.

## Creating a Extension

Extensions are dynamically loaded. Their capabilities are defined by entry points defined in their `package.json` (`main` for API/Server, `browser` for View/Client).

A standard extension exports a lifecycle object (same shape as core modules):

```javascript
// Example Extension API (api/index.js) or view (views/index.js) entry
export default {
  async providers({ container }) {
    // Bind services
  },
  async boot({ container, registry }) {
    // Register hooks, slots, IPC handlers.
    // IPC handlers are authenticated by default; opt in to guests with:
    registry.registerHandler('ipc:<id>:ping', handler, { public: true });
    // Keep the callback reference if shutdown() unregisters a collector
    // hook: hooks are removed by identity, handlers by id alone.
  },
  async shutdown({ registry }) {
    // Automatic cleanup happens via the Registry,
    // but custom teardown goes here (e.g. closing DB connections)
  },
  routes() {
    return [
      'posts',
      import.meta.webpackContext('./routes', { recursive: true }),
    ];
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
│   └── Registry.js  # Client registry (slots re-render on change)
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

| Constant           | Source                                                                 | Example         |
| ------------------ | ---------------------------------------------------------------------- | --------------- |
| `__EXTENSION_ID__` | `hashids(sha256(manifest.name))`, fixed salt — generated at build time | `TJO7Yw61SwQzV` |

This is URL-safe (alphanumeric only) and used consistently for IPC hook IDs, URL paths, route params, i18n namespaces, migration prefixes, and logging.

The build pipeline generates `id` via `generateExtensionId(name)` and writes it into the output `package.json`. The server-side `readManifest()` reads `manifest.id` directly and attaches `manifest.compatibility` from the host contract.

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

| #   | Phase          | Description                                                                                                                                                       |
| --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `translations` | Register i18n namespaces                                                                                                                                          |
| 2   | `providers`    | Bind DI services                                                                                                                                                  |
| 3   | `menus`        | `registerMenu(...)` — navigation belongs to the extension, not to one of its routes. Also re-run per SSR request and on language change, so it must be idempotent |
| 4   | `boot`         | Module-level initialization                                                                                                                                       |
| 5   | `shutdown`     | Reverse of `boot`/`menus`; runs on deactivation only                                                                                                              |
| 6   | `routes`       | Inject view routes                                                                                                                                                |

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
7. Runs the full view lifecycle (`translations → providers → menus → boot → routes`); `deactivateViewNamespace` later runs `shutdown → removeNamespace → unregister`.

## Server Extension Manager (`server/ExtensionManager.js`)

Operates in Node.js and relies on standard `fs` resolution and non-rspack `require()`.

### Execution Flow:

1. Exposes logic to resolve the exact physical directory of a extension, supporting dev-mode overrides (checking `XNAPIFY_EXTENSION_LOCAL_PATH` first, then standard paths).
2. Deletes the `require` cache entry for the targeted module ensuring fresh code is loaded on HMR.
3. Loads the module cleanly utilizing `__non_webpack_require__`.
4. Runs the full API lifecycle (`translations → providers → migrations → models → seeds → boot → routes`).
5. For view modules, runs the view lifecycle (`translations → providers → menus → boot → routes`).
6. Caches generated CSS and JS entry points to serialize into SSR HTML responses.
7. On uninstall, auto-reverts seeds and migrations using the extension's declarative contexts.
