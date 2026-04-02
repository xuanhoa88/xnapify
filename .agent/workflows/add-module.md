---
description: Add a full-stack module with API, views, models, and auto-discovery
---

Add a new module with backend API routes, frontend views, database models, and auto-discovery.

> **Prerequisites:** Before starting, consider using the `brainstorming` skill for design exploration and the `writing-plans` skill for implementation planning. Use the `test-driven-development` skill during implementation.

## Module Overview

A module is a self-contained feature bundle with:

- **Backend (API):** Routes, controllers, services, models, migrations, seeds
- **Frontend (Views):** Pages, components, styles, Redux state

The application uses **auto-discovery** to load modules from `src/apps/{module-name}/`:

- API modules are discovered via `api/index.js` lifecycle hooks
- Frontend views are discovered via `views/index.js` lifecycle hooks

## Module Structure

```
src/apps/{module-name}/
├── package.json                     # Module metadata
├── api/
│   ├── index.js                     # Backend lifecycle hooks
│   ├── constants.js                 # Module constants
│   ├── controllers/                 # Business logic
│   │   └── module.controller.js
│   ├── services/                    # Data services
│   │   └── module.service.js
│   ├── models/                      # Sequelize models
│   │   └── Model.js
│   ├── database/
│   │   ├── migrations/              # Database migrations
│   │   │   └── 1.initial.js
│   │   └── seeds/                   # Database seeds
│   │       └── 1.initial.js
│   ├── routes/                      # File-based API routes
│   │   ├── (admin)/                 # Admin route group
│   │   │   ├── (default)/_route.js  # GET /api/modules, POST
│   │   │   ├── list/_route.js       # GET /api/modules/list
│   │   │   └── [id]/_route.js       # GET /api/modules/:id
│   │   └── status/_route.js         # GET /api/modules/status
│   └── utils/                       # Utility functions
│       └── module.util.js
├── views/
│   ├── index.js                     # Frontend lifecycle hooks
│   ├── (admin)/                     # Admin layout/routes group
│   │   ├── _layout.js               # Admin layout wrapper
│   │   ├── (default)/_route.js      # /admin/modules
│   │   ├── list/
│   │   │   ├── _route.js
│   │   │   └── ModuleList.js
│   │   └── [id]/
│   │       ├── _route.js
│   │       └── ModuleDetail.js
│   └── redux/                       # Module-level Redux state
│       ├── slice.js
│       └── thunks.js
├── validator/                       # Validation schemas
│   └── index.js
└── translations/                    # i18n translations (optional)
    ├── en-US.json
    └── vi-VN.json
```

## Step-by-Step Guide

### 1. Create Module Directory & package.json

```bash
mkdir -p src/apps/{module-name}/{api,views}/{(admin),(default)}
```

```json
{
  "name": "@xnapify-module/{module-name}",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Module description"
}
```

**Example:**

```json
{
  "name": "@xnapify-module/products",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Products management module"
}
```

### 2. Create Backend Module (API)

```javascript
// src/apps/{module-name}/api/index.js
/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Auto-load migrations
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

// Auto-load seeds
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

// Auto-load models
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);

// Auto-load routes (file-based dynamic routing)
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  // -----------------------------------------------------------------------
  // Declarative hooks — autoloader handles execution
  // -----------------------------------------------------------------------
  migrations: () => migrationsContext,
  models: () => modelsContext,
  routes: () => routesContext,

  // -----------------------------------------------------------------------
  // Translations hook — return webpack require.context for i18n files.
  // -----------------------------------------------------------------------
  // translations() {
  //   return require.context('./translations', false, /\.json$/i);
  // },

  // -----------------------------------------------------------------------
  // Providers hook — share services with other modules via container.
  // Called during API bootstrap before initialization.
  // -----------------------------------------------------------------------
  async providers({ container }) {
    container.bind(
      '{module-name}:controllers',
      () => ({
        // export as destructured imports: import * as controller from './controllers'
      }),
      true, // isSingleton
    );
  },

  // -----------------------------------------------------------------------
  // Seeds hook (declarative) — return context, autoloader executes.
  // Called after migrations.
  // -----------------------------------------------------------------------
  seeds: () => seedsContext,

  // -----------------------------------------------------------------------
  // Boot hook — initialize module after all models are loaded.
  // Register auth strategies, webhooks, scheduled tasks, etc.
  // -----------------------------------------------------------------------
  async boot({ container }) {
    const hook = container.resolve('hook');

    hook('{module-name}').on('created', async entity => {
      console.log('Entity created:', entity);
    });
  },
};
```

### 3. Create API Routes (File-Based)

Routes follow file-based pattern: method names map to HTTP verbs

```javascript
// src/apps/{module-name}/api/routes/(admin)/(default)/_route.js
/**
 * Auto-discovered route: GET /api/{module-name}, POST /api/{module-name}
 * File: (admin)/(default)/_route.js = /api/{module-name}
 */

import * as controller from '../../../controllers/module.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const auth = req.container.resolve('auth');
    return auth.middlewares.requirePermission(permission)(req, res, next);
  };
}

// GET /api/{module-name}
export const get = [requirePermission('{module-name}:read'), controller.list];

// POST /api/{module-name}
export const post = [
  requirePermission('{module-name}:create'),
  controller.create,
];

// PUT /api/{module-name} (bulk update)
export const put = [
  requirePermission('{module-name}:write'),
  controller.bulkUpdate,
];

// DELETE /api/{module-name} (bulk delete)
export const del = [
  requirePermission('{module-name}:delete'),
  controller.bulkDelete,
];

export { del as delete }; // Alias for delete keyword
```

**Dynamic Route File:**

```javascript
// src/apps/{module-name}/api/routes/(admin)/[id]/_route.js
/**
 * Auto-discovered route: GET /api/{module-name}/:id, etc.
 * File: (admin)/[id]/_route.js = /api/{module-name}/:id
 */

import * as controller from '../../../../controllers/module.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const auth = req.container.resolve('auth');
    return auth.middlewares.requirePermission(permission)(req, res, next);
  };
}

// GET /api/{module-name}/:id
export const get = [requirePermission('{module-name}:read'), controller.getOne];

// PATCH /api/{module-name}/:id
export const patch = [
  requirePermission('{module-name}:write'),
  controller.update,
];

// DELETE /api/{module-name}/:id
export const del = [
  requirePermission('{module-name}:delete'),
  controller.delete,
];

export { del as delete };
```

**Route Method Mappings:**

- `get` → GET
- `post` → POST
- `put` → PUT / PATCH (both work)
- `patch` → PATCH
- `del` / `delete` → DELETE
- `head` → HEAD
- `options` → OPTIONS

### 4. Create Controllers & Services

```javascript
// src/apps/{module-name}/api/controllers/module.controller.js
/**
 * Business logic controllers
 */

export async function list(req, res, next) {
  try {
    const { models } = req.container.resolve('db');
    const items = await models.Module.findAll();
    res.json(items);
  } catch (error) {
    next(error);
  }
}

export async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const { models } = req.container.resolve('db');
    const item = await models.Module.findByPk(id);

    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const { models } = req.container.resolve('db');
    const item = await models.Module.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { models } = req.container.resolve('db');
    const item = await models.Module.findByPk(id);

    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }

    await item.update(req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function delete(req, res, next) {
  try {
    const { id } = req.params;
    const { models } = req.container.resolve('db');
    const item = await models.Module.findByPk(id);

    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }

    await item.destroy();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdate(req, res, next) {
  // Implement bulk update logic
}

export async function bulkDelete(req, res, next) {
  // Implement bulk delete logic
}
```

### 5. Create Database Models

```javascript
// src/apps/{module-name}/api/models/Module.js
/**
 * Module Model Factory
 */

export default function createModuleModel({ connection, DataTypes }) {
  const types = DataTypes || connection.constructor.DataTypes;

  const Module = connection.define('Module', {
    id: {
      type: types.UUID,
      defaultValue: types.UUIDV1,
      primaryKey: true,
    },
    name: {
      type: types.STRING,
      allowNull: false,
    },
    description: {
      type: types.TEXT,
    },
    status: {
      type: types.ENUM('active', 'inactive'),
      defaultValue: 'active',
    },
    createdAt: {
      type: types.DATE,
      defaultValue: types.NOW,
    },
    updatedAt: {
      type: types.DATE,
      defaultValue: types.NOW,
    },
  });

  return Module;
}
```

### 6. Create Migrations

```javascript
// src/apps/{module-name}/api/database/migrations/1.initial.js
/**
 * Migration: Create module tables
 */

export async function up(connection, Sequelize) {
  const queryInterface = connection.queryInterface;

  await queryInterface.createTable('modules', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV1,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive'),
      defaultValue: 'active',
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    updatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
  });
}

export async function down(connection, Sequelize) {
  const queryInterface = connection.queryInterface;
  await queryInterface.dropTable('modules');
}
```

### 7. Create Frontend Module (Views)

```javascript
// src/apps/{module-name}/views/index.js
/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('{module-name}:views');

// Auto-load contexts
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  /**
   * Providers hook — share client-side services with other modules.
   * Use for container bindings only. Redux injection goes in _route.js init().
   */
  providers({ container }) {
    container.bind(
      '{module-name}:admin:state',
      () => ({ selectors, thunks }),
      OWNER_KEY,
    );
  },

  routes: () => viewsContext,
};
```

### 8. Create View Routes

Frontend routes work similarly to backend routes, but use React:

```javascript
// src/apps/{module-name}/views/(admin)/(default)/_route.js
/**
 * Auto-discovered view route: /admin/{module-name}
 * File: (admin)/(default)/_route.js = /admin/{module-name}
 */

import { requirePermission } from '@shared/renderer/components/Rbac';
import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '@shared/renderer/redux';
import reducer, { SLICE_NAME } from '../redux';
import ModuleList from './ModuleList';

/**
 * Optional: Override the namespace used for extension activation.
 */
// export const namespace = '{module-name}';

/**
 * Middleware — permission guard
 */
export const middleware = requirePermission('{module-name}:read');

/**
 * Init — inject Redux reducer (runs once per route)
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Setup — register sidebar menus (runs once when route discovered)
 */
export function setup({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: '{module-name}',
      label: i18n.t('admin:navigation.{module-name}', 'Module'),
      order: 20,
      icon: 'folder',
      items: [
        {
          path: '/admin/{module-name}',
          label: i18n.t('admin:navigation.{module-name}', 'Module'),
          icon: 'folder',
          permission: '{module-name}:read',
          order: 10,
        },
      ],
    }),
  );
}

/**
 * Teardown — unregister menus (runs when route unloaded)
 */
export function teardown({ store }) {
  store.dispatch(
    unregisterMenu({ ns: 'admin', path: '/admin/{module-name}' }),
  );
}

/**
 * Mount — dispatch breadcrumbs (runs on each navigation)
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      { label: i18n.t('admin:navigation.{module-name}', 'Module'), url: path },
      'admin',
    ),
  );
}

/**
 * Data fetching — server-side & client-side
 */
export async function getInitialProps({ fetch, i18n }) {
  const { data } = await fetch('/api/{module-name}');

  return {
    title: i18n.t('{module-name}.title', 'Module'),
    items: data,
  };
}

/**
 * Default export — page component
 */
export default ModuleList;
```

**Dynamic View Route:**

```javascript
// src/apps/{module-name}/views/(admin)/[id]/_route.js
import ModuleDetail from './ModuleDetail';

export async function getInitialProps({ fetch, params, i18n }) {
  const { id } = params;
  const { data: item } = await fetch(`/api/{module-name}/${id}`);

  return {
    title: item.name,
    item,
  };
}

export default ModuleDetail;
```

### 9. Create View Component

```javascript
// src/apps/{module-name}/views/(admin)/(default)/ModuleList.js
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { fetchModules } from '../redux/thunks';
import s from './ModuleList.css';

function ModuleList({ items }) {
  const dispatch = useDispatch();
  const { t } = useTranslation('{module-name}');
  const { items: modules, loading } = useSelector(
    state => state['{module-name}'],
  );

  useEffect(() => {
    if (!modules.length) {
      dispatch(fetchModules());
    }
  }, [dispatch, modules.length]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className={s.container}>
      <h1>{t('title')}</h1>
      <table>
        <thead>
          <tr>
            <th>{t('name')}</th>
            <th>{t('status')}</th>
            <th>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {modules.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.status}</td>
              <td>
                <a href={`/admin/{module-name}/${item.id}`}>Edit</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ModuleList;
```

### 10. Create Redux State

```javascript
// src/apps/{module-name}/views/(admin)/redux/slice.js
import { createSlice } from '@reduxjs/toolkit';
import { fetchModules, createModule } from './thunks';

export const SLICE_NAME = '@{module-name}/admin';

const initialState = {
  items: [],
  loading: false,
  error: null,
};

const slice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchModules.pending, state => {
        state.loading = true;
      })
      .addCase(fetchModules.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })
      .addCase(createModule.pending, state => {
        state.loading = true;
      })
      .addCase(createModule.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.loading = false;
      })
      .addCase(createModule.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;
```

```javascript
// src/apps/{module-name}/views/(admin)/redux/thunks.js
import { createAsyncThunk } from '@reduxjs/toolkit';

export const fetchModules = createAsyncThunk(
  '{module-name}/fetchModules',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/{module-name}', {
        query: options,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const createModule = createAsyncThunk(
  '{module-name}/createModule',
  async (payload, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/{module-name}', {
        method: 'POST',
        body: payload,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
```

## Module Discovery

Modules are auto-discovered during application bootstrap:

**Backend:** `src/bootstrap/api/index.js`

- Scans `src/apps/*/api/index.js` for lifecycle hooks
- Hooks called in order: `translations` → `providers` → `migrations` → `models` → `seeds` → `boot` → `routes`

**Frontend:** `src/bootstrap/views.js`

- Scans `src/apps/*/views/index.js` for lifecycle hooks
- Hooks called in order: `translations` → `providers` → `boot` → `routes`

**Naming Convention:**

- Use alphanumeric + underscore for module names
- Module name controls load order
- Examples: `(default)`, `auth`, `users`, `permissions`

## Lifecycle Hooks Reference

### Backend (API)

| Hook                       | Purpose                                | Called When              | Async |
| -------------------------- | -------------------------------------- | ------------------------ | ----- |
| `translations()`           | Provide webpack context for i18n files | Module loaded            | No    |
| `providers({ container })` | Bind services to container             | After translations       | Yes   |
| `migrations()`             | Return migrations webpack context      | After providers          | No    |
| `models()`                 | Return models webpack context          | After migrations         | No    |
| `seeds()`                  | Return seeds webpack context           | After models             | No    |
| `boot({ container })`      | Initialize module (hooks, schedules)   | After seeds              | Yes   |
| `routes()`                 | Return routes webpack context          | After boot               | No    |

### Frontend (Views)

| Hook                       | Purpose                        | Called When          | Async |
| -------------------------- | ------------------------------ | -------------------- | ----- |
| `translations()`           | Provide webpack context for i18n files | Module loaded | No    |
| `providers({ container })` | Bind client services           | After translations   | No    |
| `routes()`                 | Return views webpack context   | After providers      | No    |

## API File-Based Routing

Routes are discovered from `api/routes/` using Express HTTP methods as exports:

**Routes Pattern:**

```
api/routes/
├── (group)/          # Route group (not in URL)
│   ├── (default)/_route.js  # GET /api/module, POST /api/module
│   ├── list/_route.js       # GET /api/module/list
│   └── [id]/_route.js       # GET /api/module/:id
└── [paramName]/_route.js
```

## Frontend File-Based Routing

Routes are discovered from `views/` using special files:

**Route Files:**

- `_route.js` - Page route definition
- `_layout.js` - Layout wrapper for nested routes
- `(group)/` - Grouping (optional, not in URL)
- `[paramName]/` - Dynamic segments

## Best Practices

1. **Naming:** Use `@xnapify-module/{name}` for packages
2. **Module Order:** Prefix with number if load order matters (e.g., `0_auth`, `1_users`)
3. **Separation:** Keep API and Views completely separate
4. **Permissions:** Always check permissions in route controllers
5. **Migrations:** Use versioned filenames (1.initial.js, 2.add_field.js)
6. **Error Handling:** Use try-catch in controllers, pass to Express error handler
7. **Container:** Bind reusable services to container in providers hook
8. **Webpack Context:** Use `require.context()` for auto-loading files
9. **Translations:** Prefix i18n keys with module name (e.g., `{module-name}:label.key`)
10. **Testing:** Create test files adjacent to code (\*.test.js)

## Common Issues

### Module Not Loading

- Check `src/apps/{module-name}/api/index.js` exists with exports
- Check `src/apps/{module-name}/views/index.js` exists with exports
- Verify webpack contexts use correct patterns
- Check browser/server console for errors

### Routes Not Discovered

- Verify route files are in `api/routes/` with `.js` extension
- Check route exports match HTTP methods: `get`, `post`, `put`, `patch`, `del`
- File/folder pattern: `(group)/(default)/_route.js` = `/api/module`
- Dynamic segments must be in brackets: `[id]` not `{id}`

### Views Not Found

- Check view pattern in views regex: `_route.js`, `_layout.js`
- Verify view route exports `default` component
- Check middleware returns `next()` for route to continue
- Ensure Redux store is injected in `views/index.js` `providers()` hook
- If using as an extension module, verify namespace activation — check console for `[ExtensionManager] Activating namespace:` logs
- A `_route.js` can export `namespace` to override which namespace the route belongs to

### Database Models Missing

- Check model exports are in `api/models/` directory
- Verify model name matches Sequelize model definition
- Ensure migrations create required tables before model usage

## Example: Complete Products Module

See `src/apps/users/` for a complete working example with:

- Multi-level routes with dynamic segments
- Database models with relationships
- Migrations and seeds
- Admin views and Redux state
- RBAC permission integration

### 11. AI Specification (Optional)

Each module can optionally include a `SPEC.md` file in its root directory to document specific features for AI assistance. To avoid duplication, start from the global template:

- **Template:** [.agent/templates/SPEC.template.md](file:///Users/xuanguyen/Workspaces/react-starter-kit/.agent/templates/SPEC.template.md)

Copy this template to `src/apps/{module-name}/SPEC.md` when planning a new feature.

---

## Appendix A: Scheduled Tasks

Register cron tasks in the module's `boot()` hook using the schedule engine:

```javascript
// Inside boot({ container })
const schedule = container.resolve('schedule');

// Lightweight task — runs directly
schedule.register('{module}:daily-cleanup', '0 0 * * *', async () => {
  const { models } = container.resolve('db');
  await models.TempFile.destroy({
    where: { createdAt: { [Op.lt]: subDays(new Date(), 7) } },
  });
});

// Heavy task — call worker function directly
schedule.register('{module}:weekly-report', '0 9 * * 1', async () => {
  const { generateReport } = require('./workers');
  const models = container.resolve('models');
  await generateReport(models, { week: getCurrentWeek() });
});
```

### Common Cron Expressions

| Expression | Schedule |
|---|---|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * 1` | Monday at 9 AM |
| `0 0 1 * *` | First of each month |

### Guidelines

- **Keep handlers lightweight.** For heavy processing, call worker functions directly.
- **Use descriptive task names.** Format: `{module}:{action}` (e.g., `billing:invoice-reminders`).
- **Log execution.** Always log start/completion for debugging cron issues.
- **Handle errors.** Wrap handler body in try-catch — uncaught errors in cron handlers are silent.

---

## Appendix B: Webhook Handlers

Register inbound webhook handlers in the module's `boot()` hook:

```javascript
// Inside boot({ container })
const webhook = container.resolve('webhook');

webhook.register('{provider-name}', {
  // Secret for HMAC signature verification
  secret: process.env.XNAPIFY_{PROVIDER}_WEBHOOK_KEY,

  // Handle the verified payload
  async handler({ event, payload, headers }) {
    switch (event) {
      case 'payment.completed':
        await handlePaymentCompleted(payload);
        break;
      case 'subscription.canceled':
        await handleSubscriptionCanceled(payload);
        break;
      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
    }
  },
});
```

### Guidelines

- **Always verify signatures.** The webhook engine handles HMAC verification automatically when `secret` is provided.
- **Use descriptive provider names.** E.g., `stripe`, `github`, `sendgrid`.
- **Return quickly.** Acknowledge the webhook and process asynchronously if needed (dispatch to queue or call worker function).
- **Store the secret** in an env var ending with `_KEY` (e.g., `XNAPIFY_{PROVIDER}_WEBHOOK_KEY`). The `_KEY` suffix auto-excludes it from client bundles.

---

## See Also

- `/add-data` — Models, migrations, and seeds in detail
- `/add-view` — View routes with lifecycle hooks and layouts
- `/add-redux` — Redux Toolkit slice, thunks, and selectors
- `/add-worker` — Background workers with direct function calls
- `/add-api-route` — Lightweight single-route addition (no full scaffold)
- `/add-test` — Jest unit and integration tests
- `/add-extension` — Extension development with slots and hooks
- `/security-audit` — Audit the new module for security compliance
- `/update-code` — Modify existing module code with test verification
