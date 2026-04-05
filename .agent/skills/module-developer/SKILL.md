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
   - `boot({ container })`: registers hooks, schedules, queue-based workers, or background worker functions. Runs after all models are loaded.
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

---

## Worker Function Registration

Modules can offload processing to dedicated worker functions. Register and call them in `boot()` directly.

### Pattern: Direct Worker Functions

```javascript
// api/index.js — boot hook
async boot({ container }) {
  const search = container.resolve('search');

  if (search) {
    const { indexAllItems, registerSearchHooks } = require('./workers');
    registerSearchHooks(container, search);

    const count = await search.withNamespace('moduleName').count();
    if (count === 0) {
      const models = container.resolve('models');
      indexAllItems(search, models)
        .then(r => console.info(`[ModuleName] Indexed ${r.count} item(s)`))
        .catch(e => console.error('[ModuleName] Indexing failed:', e.message));
    }
  }
}
```

### Pattern: Worker Barrel File

```javascript
// api/workers/index.js
import { INDEX_ALL } from './search.worker';
import { PROCESS_TASK } from './task.worker';

export async function indexAllItems(search, models) {
  return await INDEX_ALL({ search, models });
}

export function registerSearchHooks(container, search) {
  const hook = container.resolve('hook');
  if (!hook) return;

  hook('moduleName').on('created', async ({ id }) => {
    await search.withNamespace('moduleName').index({ id });
  });
}

export async function processTask(data) {
  return await PROCESS_TASK(data);
}
```

> **Note:** Worker functions run same-process. No pool abstraction or CJS constraints.

---

## Schedule Registration

Register cron-based recurring tasks in `boot()`:

```javascript
async boot({ container }) {
  const schedule = container.resolve('schedule');

  schedule.register(
    'moduleName:cleanup-expired',       // unique task name
    '0 3 * * *',                        // cron: 3 AM daily
    async () => {
      const models = container.resolve('models');
      await models.SomeModel.destroy({
        where: { expiresAt: { [Op.lt]: new Date() } },
      });
    },
    { timezone: 'UTC' },
  );
}
```

| Method | Description |
|--------|-------------|
| `schedule.register(name, cron, handler, opts?)` | Register a cron task |
| `schedule.unregister(name)` | Stop and remove a task |
| `schedule.getStats()` | Get all task statuses |

---

## Email from Modules

Two patterns for sending emails:

### Pattern 1: Hook API (Recommended)

```javascript
const hook = container.resolve('hook');
hook('emails').emit('send', {
  slug: 'welcome-email',
  to: user.email,
  html: '<p>Welcome, {{ name }}!</p>',
  data: { name: user.name },
});
```

### Pattern 2: Direct DI Resolution

```javascript
const sendEmail = container.resolve('emails:send');
if (sendEmail) {
  await sendEmail('welcome-email', {
    to: user.email,
    subject: 'Welcome!',
    html: '<p>Welcome, {{ name }}!</p>',
    templateData: { name: user.name },
  });
}
```

> Base template variables (`appName`, `loginUrl`, `now`, etc.) are auto-injected by the email engine.

---

## Cache Patterns

Access cache via DI with namespace isolation:

```javascript
async boot({ container }) {
  const cache = container.resolve('cache');
  const moduleCache = cache.withNamespace('moduleName');

  // In service methods:
  const cached = await moduleCache.get('key');
  if (cached) return cached;

  const data = await fetchExpensiveData();
  await moduleCache.set('key', data, 60_000); // 60s TTL
  return data;
}
```

| Method | Description |
|--------|-------------|
| `cache.withNamespace(ns)` | Create scoped cache (keys prefixed with `ns:`) |
| `cache.get(key)` | Get value or `null` |
| `cache.set(key, value, ttl?)` | Set with optional TTL (ms) |
| `cache.delete(key)` | Remove entry |
| `cache.has(key)` | Check existence |
| `cache.clear()` | Remove all namespaced entries |

> In `__DEV__` mode, cache is automatically a NoOp (returns `null` for all reads).

---

## Hook Registration in boot()

Register and listen for application events:

```javascript
async boot({ container }) {
  const hook = container.resolve('hook');

  // Listen for events from other modules
  hook('auth.permissions').on('resolve', getUserRBACData);
  hook('auth.strategy.api_key').on('authenticate', handleApiKeyAuth);

  // Emit events for other modules
  hook('moduleName').emit('created', { id: newEntity.id });
}
```

---

## DI Container Services Reference

| Service Key | Engine | Returns |
|-------------|--------|---------|
| `'db'` | Database | Sequelize connection manager |
| `'models'` | Database | All registered Sequelize models |
| `'cache'` | Cache | Cache adapter with `withNamespace()` |
| `'hook'` | Hook | Hook factory `hook(name)` |
| `'auth'` | Auth | Auth service with JWT, RBAC helpers |
| `'email'` | Email | EmailManager with `send()` |
| `'emails:send'` | Email | Direct send function (module-registered) |
| `'schedule'` | Schedule | ScheduleManager with `register()` |
| `'search'` | Search | Search engine (FlexSearch/MeiliSearch) |
| `'http'` | HTTP | Request helpers `sendSuccess`, `sendError` |
| `'template'` | Template | LiquidJS template renderer |
| `'fs'` | Filesystem | File operations with path guards |
| `'queue'` | Queue | Channel-based pub/sub job queue |
| `'webhook'` | Webhook | WebhookManager with dispatch/verify |
| `'ws'` | WebSocket | WebSocket server instance |

---

## Best Practices

- **Do not use static imports** between independent `apps/` domains. Use the DI `container.resolve()` or `hook` system to share logic.
- Follow the exact `_route.js` format for the frontend router.
- Always use `const ContextName = require.context(...)` inside the `index.js` files precisely as described, because Webpack statically analyzes these strings.
- **Redux injection** should happen in `_route.js` `init()` hooks, not in `views/index.js` `providers()`.
- Guard optional services with `container.has()` before `container.make()` to avoid crashes when an engine is not loaded.

---

## Related Skills & Workflows

| Need | Skill / Workflow |
|------|-----------------|
| Coding standards, syntax rules | `clean-code` skill |
| Security (Zod, RBAC) | `security-auditor` skill |
| Adding tests | `/add-test` workflow |
| Frontend design | `frontend-design` skill |
| Adding a single route quickly | `/add-api-route` workflow |
| Full module scaffolding | `/add-module` workflow |
| Extension development | `extension-developer` skill |
| Database patterns | `database-developer` skill |
