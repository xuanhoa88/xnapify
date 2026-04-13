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

### Client-side (React)

Public settings are available via the API:

```javascript
// In a React component or thunk:
const response = await fetch('/api/settings/public');
const { data } = await response.json();
// data = { 'core.APP_NAME': 'My App', 'core.MAINTENANCE_MODE': false, ... }
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

| Type | DB Storage | Coerced Output | Admin UI Control |
|---|---|---|---|
| `string` | Plain text | `string` | Text input |
| `boolean` | `'true'`/`'false'` | `true`/`false` | Toggle switch |
| `integer` | Numeric string | `number` | Number input |
| `json` | JSON string | `object` | Textarea (code) |
| `password` | Plain text | `string` | Masked input |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/settings` | `settings:read` | All settings grouped by namespace |
| `GET` | `/api/admin/settings/:namespace` | `settings.{ns}:read` | Settings for one namespace |
| `PUT` | `/api/admin/settings/:namespace` | `settings.{ns}:write` | Update settings for a namespace |
| `GET` | `/api/settings/public` | None | Public settings as flat map |

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
│   │   └── public/                 # Public endpoint
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
├── SPEC.md
├── README.md
└── package.json
```
