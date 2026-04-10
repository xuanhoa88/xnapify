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

- **`computeChecksum(dir)`**: Computes SHA-256 hash of an extension directory.
- **`verifyChecksum(dir, expected)`**: Verifies a directory's checksum matches an expected value.

### Queue-Based Handlers (`api/services/extension.workers.js`)

Stateful operations that need `app` access (models, hooks, extension manager, WebSocket) use the Queue Engine:

- **`install`**: Runs npm install, computes checksum (via direct function call), reloads extension, emits hooks.
- **`delete`**: Unloads extension, removes files (with path traversal guard), destroys DB record.
- **`toggle`**: Verifies checksum (via direct function call) before activation, installs/uninstalls deps, manages extension load state.

Handlers are registered in the `boot({ container })` lifecycle hook and capture `app` via closure.

---

_Note: This spec reflects the CURRENT implementation of the extension system._
