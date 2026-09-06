# Core Module AI Instructions

This folder (`src/apps/extensions/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.

1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.

---

# Extensions Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the extension ecosystem and extensibility logic inside `src/apps/extensions`.
> This module manages the lifecycle of external extensions that hook into the core system.

---

## Objective

Provide a unified framework for installing, managing, and executing system extensions with isolated runtime environments and IPC capabilities.

## 1. Database Modifications (`api/models`)

- **Model:** `Extension`
  - **Properties:**
    - `id`: UUID (Primary Key)
    - `name`: String (Display name)
    - `key`: String (Unique identifier, e.g., `user-analytics-extension`)
    - `version`: String (SemVer)
    - `status`: Enum (`active`, `inactive`, `error`)
    - `config`: JSON (Extension-specific settings)
    - `checksum`: String (For security verification)

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `GET /api/extensions`
  - **Security:** Requires `extensions:read` permission.
  - **Logic:** Lists all installed extensions and their current status.
- **Method & Path:** `POST /api/extensions/upload`
  - **Security:** Requires `extensions:manage` permission.
  - **Logic:** Receives extension bundle (.zip), verifies checksum, and extracts to extension storage.
- **Method & Path:** `PATCH /api/extensions/[id]/status`
  - **Logic:** Enables or disables an extension, triggering hot-reloading of slots and hooks.
- **Method & Path:** `POST /api/extensions/[id]/ipc`
  - **Logic:** Provides an Inter-Process Communication gateway for extensions to interact with the core application services.
- **Method & Path:** `GET /api/extensions/[id]/static/[...path]`
  - **Logic:** Serves internal static assets belonging to a specific extension.

## 3. Frontend SSR Rendering (`views/`)

- **Admin View:** `/admin/extensions`
  - **Component:** `ExtensionManager.js`.
  - **Logic:** Dashboard for managing the extension ecosystem, showing active slots, hooks, and allowing status toggles. Includes upload interface for new extensions.
- **Registry:** Interacts with `@shared/extension` to register UI slots and logic hooks at runtime.

## 4. Localization (`translations/`)

- **Keys:** `extensions.status.active`, `extensions.actions.install`, `extensions.errors.invalid_checksum`.
- **Note:** Extension descriptions and UI labels may come from the extension's own translation files, which are merged into the global i18next instance.

## 5. Workers & Background Processing (`api/utils/`, `api/services/extension.workers.js`)

### Checksum Utilities (`api/utils/checksum.util.js`)

Checksum operations are called directly (same-process):

- **`computeChecksum(dir, { manifest })`**: SHA-256 of an extension directory.
- **`verifyExtensionChecksum(dir, expected)`**: Verifies a directory against an expected value.

The checksum is the hash of two parts: the file tree **excluding `package.json`**,
and the manifest with `integrity` and `builtAt` stripped and its keys sorted.
The split is what makes the value verifiable at all — the build writes the
checksum *into* the manifest it just hashed, so those two fields cannot be part
of their own input. Everything else in the manifest (entry points, dependencies,
declared capabilities) is still covered, so tampering invalidates the hash.

`tools/utils/extension.js` re-exports this module rather than reimplementing it:
the publishing side and the installing side must agree bit-for-bit, and two
copies drift. Keep this file free of `@shared` aliases and extension-less
imports — the build task loads it on plain Node ESM.

### Dependency Pinning

Extensions installed at runtime (zip upload or hub download) are **intentionally
unpinned**. `installExtensionDependencies()` passes `--no-package-lock`, so npm
resolves the declared ranges at install time and writes no lockfile back. A
lockfile shipped inside an extension package would describe the publisher's
machine, not this deployment, and writing one back would mutate the directory
the integrity hash covers.

The bundled extensions under `src/extensions/` therefore ship **no
`package-lock.json`**; `tools/npm/setup.js` falls back to `npm install` for
sub-packages that have none. Do not commit one — it would be honoured by
`npm ci` during development and ignored in production, which is the worst of
both worlds.

### Queue-Based Handlers (`api/services/extension.workers.js`)

Stateful operations that need `app` access (models, hooks, extension manager, WebSocket) use the Queue Engine:

- **`install`**: Runs npm install, computes checksum (via direct function call), reloads extension, emits hooks.
- **`delete`**: Unloads extension, removes files (with path traversal guard), destroys DB record.
- **`toggle`**: Verifies checksum (via direct function call) before activation, installs/uninstalls deps, manages extension load state.

Handlers are registered in the `boot({ container })` lifecycle hook and capture `app` via closure.

---

_Note: This spec reflects the CURRENT implementation of the extension system._
