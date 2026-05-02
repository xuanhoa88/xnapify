# Shared API

Server-side infrastructure — engines, module autoloading, and file-based routing.

## Quick Start

```javascript
// Import engines directly
import { db, auth, hook } from '@shared/api';
```

## Engines

All engines live in `engines/` and are auto-discovered at startup. Each engine is a singleton accessible via `import` or `container.resolve('name')`.

| Engine | Purpose | Example |
|---|---|---|
| **auth** | JWT, OAuth, permissions | `auth.middlewares.requirePermission('users:read')` |
| **cache** | Key-value store | `await cache.set('key', value, 60000)` |
| **db** | Sequelize ORM | `const { models } = container.resolve('db')` |
| **email** | Email delivery | `await email.send({ to, subject, html })` |
| **fs** | File operations | `await fs.upload({ fileName, buffer, mimeType })` |
| **hook** | Pub/sub hooks | `hook('users').on('created', handler)` |
| **http** | Request/response utils | `http.sendSuccess(res, { data })` |
| **queue** | Background jobs | `queue('emails').publish({ to, template })` |
| **schedule** | Cron tasks | `schedule.register('cleanup', '0 0 * * *', fn)` |
| **template** | LiquidJS rendering | `await template.render(html, variables)` |

## Module Autoloader

Modules in `src/apps/` are auto-discovered and booted in order:

```
translations → models → providers → migrations → seeds → init → routes
```

Each module exports lifecycle hooks in `api/index.js`:

```javascript
export function models() { return require.context('./models', ...); }
export async function providers(container) { container.instance('myService', service); }
export async function migrations(container) { /* run migrations */ }
export async function seeds(container) { /* seed data */ }
export async function init(container) { /* register hooks, workers */ }
export function routes() { return require.context('./routes', ...); }
```

## Dynamic Model Modification

Extensions and core modules can dynamically extend core models (by injecting new columns or configuration) right before they are sealed by Sequelize. Using the `providers` phase, you can listen to the `[PascalCaseModelName]:define` hook (e.g. `User:define`):

```javascript
export async function providers({ container }) {
  const hook = container.resolve('hook');
  
  hook('models').on('User:define', ({ attributes, DataTypes }) => {
    // Inject a new column before `connection.define` finishes!
    attributes.my_new_field = { type: DataTypes.STRING, allowNull: true };
  });

  hook('models').on('User:associate', ({ models, model: User }) => {
    // Dynamically inject a relation to an extension model
    User.hasMany(models.MyCustomModel, {
      foreignKey: 'user_id',
      as: 'customData',
    });
  });
}
```

## File-Based Router

Routes are defined by filesystem structure under `api/routes/`:

```
api/routes/
├── (admin)/                    # Route group (stripped from URL)
│   ├── (default)/_route.js     # GET/POST /api/{module}
│   ├── list/_route.js          # GET /api/{module}/list
│   └── [id]/_route.js          # GET/PUT/DELETE /api/{module}/:id
├── _config.js                  # Config for this route tree
└── _middleware.js              # Middleware for this route tree
```

Route files export HTTP method handlers:

```javascript
// _route.js
export const middleware = false;  // Opt out of inherited middleware

export function get(req, res) { /* handle GET */ }
export function post(req, res) { /* handle POST */ }
export const put = [authMiddleware, handler]; // Chain via array
```

## See Also

- [SPEC.md](./SPEC.md) — Full technical specification
- [router/README.md](./router/README.md) — Router details
