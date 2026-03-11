---
description: Create a new auto-discovered application module
---

When the user requests to create a new application module or feature, follow this exact workflow to ensure it integrates seamlessly with the auto-discovery engine and project architecture.

### 1. Structure Initialization
Create a new directory in `src/apps/` named after the business domain (e.g., `src/apps/blog/`).
Inside it, you typically need two main spaces:
- `api/` for backend logic
- `views/` for frontend components and pages

### 2. Backend API Setup (`src/apps/[module]/api/`)

The API requires an `index.js` file to be discovered, plus specific subdirectories.

1. **Create the directories**:
   - `controllers/`
   - `database/migrations/` and `database/seeds/`
   - `models/`
   - `routes/` (can contain nested route folders like `(admin)`)
   - `services/`

2. **Create `src/apps/[module]/api/index.js`**:
```javascript
// Auto-load contexts via Webpack
const migrationsContext = require.context('./database/migrations', false, /\.[cm]?[jt]s$/i);
const seedsContext = require.context('./database/seeds', false, /\.[cm]?[jt]s$/i);
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

/**
 * Providers hook — bound via dependency injection
 */
export async function providers(app) {
  // e.g. app.get('container').bind(...)
}

/**
 * Migrations hook — run database migrations
 */
export async function migrations(app) {
  const db = app.get('db');
  await db.connection.runMigrations([{ context: migrationsContext, prefix: 'module_name' }], { app });
}

/**
 * Seeds hook — run database seeds
 */
export async function seeds(app) {
  const db = app.get('db');
  await db.connection.runSeeds([{ context: seedsContext, prefix: 'module_name' }], { app });
}

/**
 * Init hook — register auth hooks, schedule tasks, and plugin workers
 */
export async function init(app) {
  // Initialization logic
}

/**
 * Models hook — returns the context
 */
export function models() {
  return modelsContext;
}

/**
 * Routes hook — returns the context
 */
export function routes() {
  return routesContext;
}
```

3. **Create Routes**: In `routes/`, standard `[routeId]/_route.js` or `index.js` exporting arrays of controllers. (e.g., `routes/(default)/_route.js`).

### 3. Frontend Views Setup (`src/apps/[module]/views/`)

The frontend relies on hierarchical route discovery via an `index.js` loader.

1. **Create `src/apps/[module]/views/index.js`**:
```javascript
// Auto-load view routes
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

/**
 * Providers hook — Client-side DI config
 */
export function providers({ container }) {
  // Bind view components/states
}

/**
 * Views hook — returns the context
 */
export function views() {
  return viewsContext;
}
```

2. **Create the Main Route Component** (e.g., `views/(default)/_route.js`):
```javascript
import ModulePage from './ModulePage';
import { addBreadcrumb, registerMenu } from '@shared/renderer/redux';
// import { requirePermission } from '@shared/renderer/components/Rbac';

// 1. Translations (Optional)
// export function translations() { ... }

// 2. Middleware (Optional)
// export const middleware = requirePermission('module:read');

// 3. Register
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      item: { path: '/module', label: i18n.t('navigation.module', 'Module'), icon: 'box', order: 20 },
    }),
  );
}

// 4. Boot (Optional state injection)
// export function boot({ store }) { ... }

// 5. Mount
export function mount({ store, i18n, path }) {
  store.dispatch(addBreadcrumb({ label: i18n.t('navigation.module', 'Module'), url: path }, 'admin'));
}

// 6. Page metadata (SSR data fetching)
export async function getInitialProps({ fetch, i18n }) {
  return { title: i18n.t('module.title', 'Module Title') };
}

export default ModulePage;
```

3. **Create the React Component** (`ModulePage.js`) using functional components, hooks, CSS Modules (`.module.css`), and Prop-Types.
4. **Create Redux Slice (if needed)** in a `redux/` directory using `@reduxjs/toolkit`. Ensure the slice is injected during the `boot` hook of the route.
