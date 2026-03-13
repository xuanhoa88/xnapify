# Plugins Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand the plugin ecosystem and extensibility logic inside `src/apps/plugins`.
> This module manages the lifecycle of external extensions that hook into the core system.

---

## Objective
Provide a unified framework for installing, managing, and executing system plugins with isolated runtime environments and IPC capabilities.

## 1. Database Modifications (`api/models`)
- **Model:** `Plugin`
  - **Properties:**
    - `id`: UUID (Primary Key)
    - `name`: String (Display name)
    - `key`: String (Unique identifier, e.g., `user-analytics-plugin`)
    - `version`: String (SemVer)
    - `status`: Enum (`active`, `inactive`, `error`)
    - `config`: JSON (Plugin-specific settings)
    - `checksum`: String (For security verification)

## 2. API Routes & Controllers (`api/`)
- **Method & Path:** `GET /api/plugins`
  - **Security:** Requires `plugins:read` permission.
  - **Logic:** Lists all installed plugins and their current status.
- **Method & Path:** `POST /api/plugins/upload`
  - **Security:** Requires `plugins:manage` permission.
  - **Logic:** Receives plugin bundle (.zip), verifies checksum, and extracts to plugin storage.
- **Method & Path:** `PATCH /api/plugins/[id]/status`
  - **Logic:** Enables or disables a plugin, triggering hot-reloading of slots and hooks.
- **Method & Path:** `POST /api/plugins/[id]/ipc`
  - **Logic:** Provides an Inter-Process Communication gateway for plugins to interact with the core application services.
- **Method & Path:** `GET /api/plugins/[id]/static/[...path]`
  - **Logic:** Serves internal static assets belonging to a specific plugin.

## 3. Frontend SSR Rendering (`views/`)
- **Admin View:** `/admin/plugins`
  - **Component:** `PluginManager.js`.
  - **Logic:** Dashboard for managing the plugin ecosystem, showing active slots, hooks, and allowing status toggles. Includes upload interface for new plugins.
- **Registry:** Interacts with `@shared/plugin` to register UI slots and logic hooks at runtime.

## 4. Localization (`translations/`)
- **Keys:** `plugins.status.active`, `plugins.actions.install`, `plugins.errors.invalid_checksum`.
- **Note:** Plugin descriptions and UI labels may come from the plugin's own translation files, which are merged into the global i18next instance.

---
*Note: This spec reflects the CURRENT implementation of the plugin system.*
