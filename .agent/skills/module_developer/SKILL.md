---
name: Module Developer
description: specialized skill for creating API and View modules in rapid-rsk with correct dependencies and lifecycles
---

# Module Developer Skill

This skill equips you to build new modules for the `rapid-rsk` application. Modules are automatically discovered and loaded via Webpack `require.context`.

## Core Concepts

In `rapid-rsk`, the business logic is organized into domains placed under `src/apps/`. Each domain contains:
- `api/` for all backend code (Express routes, Sequelize models, Services)
- `views/` for all frontend code (React components, Redux slices)

Modules interact with the core framework by exporting specific lifecycle hooks from their `index.js` files.

## Procedure: Creating a Backend API Module

1. **Setup Directory:** Choose a domain name `[module_name]`. Create `src/apps/[module_name]/api/`.
2. **Setup Subdirectories:** Always create `controllers`, `services`, `routes`, `models`, and `database/migrations` + `database/seeds`.
3. **The Index File (`api/index.js`):** Export the following exact lifecycle hooks:
   - `models()`: returns the Webpack context for models.
   - `providers(app)`: binds singletons/factories to the dependency injection `container`.
   - `migrations(app)`: executes `db.connection.runMigrations()`.
   - `seeds(app)`: executes `db.connection.runSeeds()`.
   - `init(app)`: registers hooks, schedules, or plugin workers.
   - `routes()`: returns the Webpack context for routes.

   *Note: Ensure you include `translations()` hook if this module provides backend i18n JSON.*

4. **Models & Migrations:** 
   Migrations run on every boot via the autoloader. Create standard Sequelize models and migrations. Ensure models have an `associate` method if they relate to other tables.

5. **Routes:** Create files like `routes/(default)/_route.js` exporting an array of middlewares/controllers.

## Procedure: Creating a Frontend View Module

1. **Setup Directory:** Create `src/apps/[module_name]/views/`.
2. **The Index File (`views/index.js`):** Export the following hooks:
   - `providers({ container })`: bind UI components or Redux states to the container for cross-module usage.
   - `views()`: returns Webpack context for view discovery.

3. **Defining Pages:** 
   Views are discovered via hierarchical `_route.js` files.
   A standard `_route.js` should export:
   - `export function register({ store, i18n })`: registers the menu item.
   - `export function mount({ store, i18n, path })`: dispatches breadcrumbs.
   - `export async function getInitialProps({ fetch, i18n })`: SSR data fetching.
   - `export default PageComponent`: the React component.

## Best Practices
- **Do not use static imports** between independent `apps/` domains. Use the DI `app.get('container')` or `hook` system to share logic.
- Follow the exact `_route.js` format for the frontend router.
- Always use `const ContextName = require.context(...)` inside the `index.js` files precisely as described, because Webpack statically analyzes these strings.
