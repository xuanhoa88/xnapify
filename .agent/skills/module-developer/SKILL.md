---
name: module-developer
description: Build API and View modules with correct auto-discovery, lifecycle hooks, and dependency wiring.
---

# Module Developer Skill

This skill equips you to build new modules for the `xnapify` application. Modules are automatically discovered and loaded via Webpack `require.context`.

## Core Concepts

In `xnapify`, the business logic is organized into domains placed under `src/apps/`. Each domain contains:
- `api/` for all backend code (Express routes, Sequelize models, Services)
- `views/` for all frontend code (React components, Redux slices)

Modules interact with the core framework by exporting a **default object** with specific lifecycle hooks from their `index.js` files.

## Procedure: Creating a Backend API Module

1. **Setup Directory:** Choose a domain name `[module_name]`. Create `src/apps/[module_name]/api/`.
2. **Setup Subdirectories:** Always create `controllers`, `services`, `routes`, `models`, and `database/migrations` + `database/seeds`.
3. **The Index File (`api/index.js`):** Export a `default` object with the following lifecycle hooks:
   - `translations()`: returns the Webpack context for locale JSON files.
   - `providers({ container })`: binds singletons/factories to the dependency injection `container`.
   - `migrations()`: returns the Webpack context for migrations (declarative — autoloader executes).
   - `models()`: returns the Webpack context for models (declarative — autoloader registers into ORM).
   - `seeds()`: returns the Webpack context for seeds (declarative — autoloader executes).
   - `boot({ container })`: registers hooks, schedules, queue-based workers, or Piscina worker pools. Runs after all models are loaded.
   - `routes()`: returns the Webpack context directly (e.g., `() => routesContext`).

   *Phase order: `translations → providers → migrations → models → seeds → boot → routes` (defined in `shared/utils/lifecycle.js`)*

4. **Models & Migrations:**
   Migrations run on every boot via the autoloader. Create standard Sequelize models and migrations. Models receive `{ connection, DataTypes }` as a destructured object. Ensure models have an `associate` method if they relate to other tables.

5. **Routes:** Create files like `routes/(admin)/(default)/_route.js` exporting HTTP verb functions or middleware arrays.

   Route-level config exports (optional):
   - `export const middleware = false` — skip inherited middleware chain
   - `export const middleware = [mw1, mw2]` — inject route-specific middlewares
   - `export const useRateLimit = false` — skip rate limiting (e.g. static assets)
   - `export const useRateLimit = { max: 200, windowMs: 60_000 }` — custom per-route limiter (merged with app defaults)
   - `export const translations = () => context` — route-specific translations

**Key distinction:** Modules return the Webpack context **directly** from `routes()` (e.g., `() => routesContext`). Extensions return a `[name, context]` tuple instead (e.g., `() => ['posts', routesContext]`).

## Procedure: Creating a Frontend View Module

1. **Setup Directory:** Create `src/apps/[module_name]/views/`.
2. **The Index File (`views/index.js`):** Export a `default` object with the following hooks:
   - `providers({ container })`: bind UI components or Redux selectors/thunks to the container for cross-module usage.
   - `routes()`: returns the Webpack context directly (e.g., `() => viewsContext`).

   *Phase order: `translations → providers → boot → routes` (defined in `shared/utils/lifecycle.js`)*

3. **Defining Pages:**
   Views are discovered via hierarchical `_route.js` files.
   A standard `_route.js` should export:
   - `export const middleware`: permission guard (e.g., `requirePermission('resource:read')`)
   - `export function init({ store })`: injects Redux reducer via `store.injectReducer(SLICE_NAME, reducer)`.
   - `export function setup({ store, i18n })`: registers the sidebar menu item.
   - `export function teardown({ store })`: unregisters the menu item.
   - `export function mount({ store, i18n, path })`: dispatches breadcrumbs.
   - `export function unmount({ store })`: cleanup on route exit.
   - `export async function getInitialProps({ fetch, i18n })`: SSR data fetching.
   - `export const namespace`: override extension namespace for the route.
   - `export default PageComponent`: the React component.

## Best Practices
- **Do not use static imports** between independent `apps/` domains. Use the DI `container.resolve()` or `hook` system to share logic.
- **Sending emails from modules**: Resolve `container.resolve('emails:send')` (registered by the emails module) or emit `hook('emails').emit('send', { to, slug, html, data })`. Base variables (`appName`, `loginUrl`, `now`, etc.) are auto-injected.
- Follow the exact `_route.js` format for the frontend router.
- Always use `const ContextName = require.context(...)` inside the `index.js` files precisely as described, because Webpack statically analyzes these strings.
- **Redux injection** should happen in `_route.js` `init()` hooks, not in `views/index.js` `providers()`.
