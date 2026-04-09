# Settings Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the global settings management inside `src/apps/settings`.
> Settings serve as a centralized key-value store grouped by module namespace, with process.env fallback.

---

## Objective
Provide a flexible, namespace-grouped settings system that allows administrators to view and modify configuration values from an admin UI (`/admin/settings`). Backend modules access settings via the DI container; the client accesses public settings via a dedicated API endpoint.

## 1. Database Modifications (`api/models`)
- **Model:** `Setting`
  - **Properties:** `id` (UUID), `namespace` (STRING, module grouping), `key` (STRING, config key), `type` (ENUM: string|boolean|integer|json|password), `value` (TEXT, nullable), `default_env_var` (STRING, nullable), `is_public` (BOOLEAN), `description` (TEXT).
  - **Unique Constraint:** `(namespace, key)`.
  - **No soft delete** — settings are hard-deleted.

## 2. API Routes & Controllers (`api/`)
- **Method & Path:** `GET /api/admin/settings`
  - **Security:** Requires `settings:read` permission.
  - **Logic:** Returns all settings grouped by namespace, with resolved values.
- **Method & Path:** `PUT /api/admin/settings`
  - **Security:** Requires `settings:write` permission.
  - **Logic:** Bulk updates settings from `{ updates: [{ namespace, key, value }] }`.
- **Method & Path:** `GET /api/admin/settings/:namespace`
  - **Security:** Requires `settings:read` permission.
  - **Logic:** Returns settings for a single namespace.
- **Method & Path:** `GET /api/settings/public`
  - **Security:** No auth required.
  - **Logic:** Returns only `is_public: true` settings as a flat key-value map.

## 3. Settings Service (DI: `'settings'`)
Registered in `providers()` phase. Available to all downstream modules.

```javascript
const settings = container.resolve('settings');

// Single value (returns coerced result: string|boolean|number|object|null)
await settings.get('auth', 'SESSION_TTL');     // → 3600

// All settings for a namespace
await settings.getAll('auth');                 // → [{ key, value, type, ... }]

// All settings grouped
await settings.getAll();                       // → { core: [...], auth: [...] }

// All public settings (flat map)
await settings.getPublic();            // → { 'core.APP_NAME': 'xnapify', ... }

// Update
await settings.set('auth', 'SESSION_TTL', '7200');
await settings.bulkUpdate([{ namespace, key, value }]);
```

### Value Resolution Order
1. DB `value` (if not NULL)
2. `process.env[default_env_var]` (if `default_env_var` is configured)
3. `null`

## 4. Frontend SSR Rendering (`views/`)
- **Admin View:** `/admin/settings`
  - **Component:** `SettingsPage.js`.
  - **Features:** Namespace tabs, type-specific inputs (toggle, number, text, JSON editor, password), env default badges, reset-to-default, bulk save.
  - **Redux Slice:** `@settings/admin`.

## 5. Seeds (`api/database/seeds/`)
- **Default settings:** Core (APP_NAME, APP_DESCRIPTION, MAINTENANCE_MODE), Auth (SESSION_TTL, ALLOW_REGISTRATION), Email (FROM_ADDRESS, FROM_NAME).
- **Permissions:** `settings:read` and `settings:write`, assigned to admin role.

## 6. Core Module Status
`settings` is registered in `CORE_MODULES` in `shared/api/autoloader.js`. The application will fail to start if this module is missing.

---
*Note: This spec reflects the CURRENT implementation of the settings module.*
