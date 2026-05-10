# Settings Module

Global configuration management for xnapify.

## Quick Start

### Server-side (any module)

```javascript
// In your module's boot() or any controller:
const settings = container.resolve('settings');

// Get a typed value (auto-coerced based on setting type)
const sessionTtl = await settings.get('auth', 'SESSION_TTL');
// → 3600 (integer) — or process.env.XNAPIFY_SESSION_TTL if DB value is null

const maintenanceMode = await settings.get('core', 'MAINTENANCE_MODE');
// → false (boolean)
```

## Adding New Settings

Add entries to the default settings seed file, or create a new seed file in your module:

```javascript
// src/apps/my-module/api/database/seeds/YYYY.MM.DDT00.00.00.my-settings.js
export async function up(_, { container }) {
  const { Setting } = container.resolve('models');

  await Setting.findOrCreate({
    where: { namespace: 'my-module', key: 'FEATURE_FLAG' },
    defaults: {
      id: uuidv4(),
      namespace: 'my-module',
      key: 'FEATURE_FLAG',
      type: 'boolean',
      value: 'true',
      default_env_var: null,
      is_public: false,
      description: 'Enable the new feature',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}
```

## Value Resolution

When you call `settings.get(namespace, key)`, values are resolved in this order:

1. **Database `value`** — if the `value` column is not NULL, it's used directly
2. **Environment variable** — if `default_env_var` is set (e.g., `XNAPIFY_SMTP_FROM`), looks up `process.env`
3. **`null`** — no value available

## Setting Types

| Type       | DB Storage         | Coerced Output | Admin UI Control |
| ---------- | ------------------ | -------------- | ---------------- |
| `string`   | Plain text         | `string`       | Text input       |
| `boolean`  | `'true'`/`'false'` | `true`/`false` | Toggle switch    |
| `integer`  | Numeric string     | `number`       | Number input     |
| `json`     | JSON string        | `object`       | Textarea (code)  |
| `password` | Plain text         | `string`       | Masked input     |

## API Endpoints

| Method | Path                             | Auth                  | Description                       |
| ------ | -------------------------------- | --------------------- | --------------------------------- |
| `GET`  | `/api/admin/settings`            | `settings:read`       | All settings grouped by namespace |
| `GET`  | `/api/admin/settings/:namespace` | `settings.{ns}:read`  | Settings for one namespace        |
| `PUT`  | `/api/admin/settings/:namespace` | `settings.{ns}:write` | Update settings for a namespace   |

## Architecture

```
src/apps/settings/
├── api/
│   ├── index.js                    # Lifecycle hooks (providers → seeds → routes)
│   ├── controllers/
│   │   └── settings.controller.js  # Route handlers
│   ├── database/
│   │   ├── migrations/             # Table creation
│   │   └── seeds/                  # Default settings + permissions
│   ├── models/
│   │   └── Setting.js              # Sequelize model
│   ├── routes/
│   │   ├── (admin)/(default)/      # Admin CRUD
│   │   ├── (admin)/[namespace]/    # Per-namespace

│   └── services/
│       └── settings.service.js     # Core service (DI: 'settings')
├── validator/
│   └── index.js                    # Zod schemas
├── views/
│   ├── index.js                    # View lifecycle
│   └── (admin)/
│       ├── (default)/
│       │   ├── _route.js           # Route config
│       │   ├── SettingsPage.js     # React component
│       │   └── SettingsPage.css    # Styles
│       └── redux/                  # Redux slice, thunks, selectors
├── README.md
└── package.json
```

---

# Settings Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the global settings management inside `src/apps/settings`.
> Settings serve as a centralized key-value store grouped by module namespace, with process.env fallback.

---

## Objective

Provide a flexible, namespace-grouped settings system that allows administrators to view and modify configuration values from an admin UI (`/admin/settings`). Backend modules access settings via the DI container; the client accesses public settings via a dedicated API endpoint.

## 1. Database Modifications (`api/models`)

- **Model:** `Setting`
  - **Properties:** `id` (UUID), `namespace` (STRING, module grouping), `key` (STRING, config key), `type` (ENUM: string|boolean|integer|json|password), `value` (TEXT, nullable), `default_env_var` (STRING, nullable), `description` (TEXT).
  - **Unique Constraint:** `(namespace, key)`.
  - **No soft delete** — settings are hard-deleted.

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `GET /api/admin/settings`
  - **Security:** Requires auth + `settings:read` permission (per-namespace RBAC).
  - **Logic:** Returns all settings grouped by namespace, with resolved values.
- **Method & Path:** `GET /api/admin/settings/:namespace`
  - **Security:** Requires auth + `settings.{namespace}:read` permission.
  - **Logic:** Returns settings for a single namespace.
- **Method & Path:** `PUT /api/admin/settings/:namespace`
  - **Security:** Requires auth + `settings.{namespace}:write` permission.
  - **Logic:** Updates settings from a flat key-value body `{ KEY: value, ... }`.

## 3. Settings Service (DI: `'settings'`)

Registered in `providers()` phase. Available to all downstream modules.

```javascript
const settings = container.resolve('settings');

// Single value (returns coerced result: string|boolean|number|object|null)
await settings.get('auth', 'JWT_EXPIRY'); // → '7d'

// All settings for a namespace
await settings.getAll('auth'); // → [{ key, value, type, ... }]

// All settings grouped
await settings.getAll(); // → { core: [...], auth: [...] }

// All public settings (flat map)
await settings.getPublic(); // → { 'core.APP_NAME': 'xnapify', ... }

// Update (syncs to process.env automatically)
await settings.set('auth', 'JWT_EXPIRY', '2h');
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

- **Default settings:** Core (APP*NAME, APP_DESCRIPTION, APP_URL, APP_IMAGE, MAINTENANCE_MODE, MAINTENANCE_BYPASS_TOKEN), Auth (JWT_EXPIRY, ALLOW_REGISTRATION, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_KEY), Email (MAIL_PROVIDER, FROM_ADDRESS, SMTP*\*), File (STORAGE_PROVIDER, MAX_UPLOAD_BYTES, ALLOWED_EXTENSIONS), Webhook (WEBHOOK_TIMEOUT_MS, MAX_RETRY_ATTEMPTS, REQUIRE_SIGNATURE), Optimization (COMPRESSION, SSR_CACHE).
- **Permissions:** `settings:read` and `settings:write`, assigned to admin role.

## 6. Core Module Status

`settings` is registered in `CORE_MODULES` in `shared/api/autoloader.js`. The application will fail to start if this module is missing.

## 7. Extension Integration (Frontend Tab Config)

While backend extensions can simply insert records into the `Setting` table to automatically get a tab in the admin UI, they can fully customize their tab's appearance via the frontend hook registry.

**Hook ID**: `settings.tabs.config`

Extensions use this in their `views/index.js` `boot()` method to return a configuration object specifying the tab's metadata:

```javascript
// Example: Extension views/index.js
export default {
  boot({ registry }) {
    registry.registerHook('settings.tabs.config', () => ({
      slack: {
        icon: '/api/extensions/slack_plugin/static/icon.svg', // External URL, absolute path, or feather icon name (e.g., 'message-circle')
        i18nKey: 'slack_plugin:settings.tabLabel', // Optional: Extension's own i18n translation key
        label: 'Slack', // Hardcoded fallback label
        order: 60, // Sort position
      },
    }));
  },
};
```

**Merge & Resolution Strategy:**

- **Per-field deep merge:** Core defaults (e.g., `core`, `auth`, `webhook`) are immutable. Extension configurations apply per-field and merge dynamically.
- **Dynamic Field Sorting:** Display order is determined by the `sort_order` integer column in the database, set during seeding. Frontend configuration does not override field ordering.
- **Icon Resolution:** Natively supports built-in feather names (`'zap'`), absolute paths to static extension assets, and external URLs (prefixed with `http`).
- **Label i18n Cascade:** Resolves in the following order: `i18nKey` (from the extension's translations) -> Core i18n -> `label` -> Raw namespace string.
- **Hot-Reload:** The UI automatically subscribes to registry changes, hot-reloading configurations when extensions are toggled.

---

_Note: This spec reflects the CURRENT implementation of the settings module._
