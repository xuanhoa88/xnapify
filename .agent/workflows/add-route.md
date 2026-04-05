---
description: Add a single API route to an existing module without full module scaffolding
---

Add one or more API routes to an existing module. This is the lightweight alternative to `/add-module` when the module already exists and you just need a new endpoint.

## When to Use

- Adding a new endpoint to an existing module
- Adding a sub-resource route (e.g., `/api/users/:id/sessions`)
- Quick CRUD endpoint addition without full scaffold

For creating a **new module from scratch**, use `/add-module` instead.

## Structure

```
@apps/{module}/api/routes/
├── (admin)/                    # Admin route group
│   ├── (default)/_route.js     # GET/POST /api/{module}
│   ├── [id]/_route.js          # GET/PATCH/DELETE /api/{module}/:id
│   └── {sub-resource}/
│       └── _route.js           # GET /api/{module}/{sub-resource}
└── {public-endpoint}/
    └── _route.js               # Public route (no admin group)
```

## Step-by-Step

### 1. Create Route File

Create the `_route.js` file at the correct path based on the desired URL:

| Desired URL | File Path |
|-------------|-----------|
| `GET /api/{module}` | `routes/(admin)/(default)/_route.js` |
| `GET /api/{module}/:id` | `routes/(admin)/[id]/_route.js` |
| `GET /api/{module}/stats` | `routes/(admin)/stats/_route.js` |
| `GET /api/{module}/:id/comments` | `routes/(admin)/[id]/comments/_route.js` |
| `GET /api/{module}/public` | `routes/public/_route.js` |

```bash
mkdir -p src/apps/{module}/api/routes/{path}
```

### 2. Write Route Definition

```javascript
// src/apps/{module}/api/routes/{path}/_route.js
/**
 * Auto-discovered route: {METHOD} /api/{module}/{path}
 */

import * as controller from '../../controllers/{resource}.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const auth = req.container.resolve('auth');
    return auth.middlewares.requirePermission(permission)(req, res, next);
  };
}

// GET /api/{module}/{path}
export const get = [requirePermission('{module}:read'), controller.list];

// POST /api/{module}/{path}
export const post = [requirePermission('{module}:create'), controller.create];
```

**Method exports:** `get`, `post`, `put`, `patch`, `del` (aliased as `delete`).

### 3. Write Controller Function

```javascript
// src/apps/{module}/api/controllers/{resource}.controller.js

import { {resourceSchema} } from '../../validator';

export async function list(req, res, next) {
  const http = req.container.resolve('http');
  try {
    const { models } = req.container.resolve('db');
    const items = await models.{Model}.findAll({ limit: 50 });
    return http.sendSuccess(res, { items });
  } catch (error) {
    return http.sendServerError(res, 'Failed to list items', error);
  }
}

export async function create(req, res, next) {
  const http = req.container.resolve('http');
  try {
    const { validateForm, z } = require('@shared/validator');
    const schema = {resourceSchema}({ z });
    const [isValid, data] = validateForm(() => schema, req.body);
    if (!isValid) return http.sendValidationError(res, data);

    const { models } = req.container.resolve('db');
    const item = await models.{Model}.create(data);
    return http.sendCreated(res, { item });
  } catch (error) {
    return http.sendServerError(res, 'Failed to create item', error);
  }
}
```

### 4. Add Validation Schema (if new)

```javascript
// src/apps/{module}/validator/{resource}.js

export const {resourceSchema} = ({ z }) => {
  return z.object({
    name: z.string().min(1).max(255),
    // Add fields...
  });
};
```

### 5. Verify Route Discovery

The route is auto-discovered via `require.context('./routes', true, /\.[cm]?[jt]s$/i)` in the module's `api/index.js`. No manual registration needed.

// turbo
```bash
# Verify the route file exists in the expected location
find src/apps/{module}/api/routes -name "_route.js" | sort
```

### 6. Run Tests

// turbo
```bash
npm test -- --testPathPattern="{module}"
```

// turbo
```bash
npm run lint
```

## Route Method Reference

| Export | HTTP Method |
|--------|------------|
| `get` | GET |
| `post` | POST |
| `put` | PUT |
| `patch` | PATCH |
| `del` / `delete` | DELETE |
| `head` | HEAD |
| `options` | OPTIONS |

## Route Decorator Exports

| Export | Type | Purpose |
|--------|------|---------|
| `middleware` | `false \| Function` | RBAC guard or explicit opt-out |
| `useRateLimit` | `false \| { max, windowMs }` | Rate limit override |

## Checklist

- [ ] Route file created at correct path for desired URL
- [ ] RBAC guard via `requirePermission()` on all exports
- [ ] Controller uses `http.sendSuccess()` / `http.sendServerError()` — never raw `res.json()`
- [ ] Input validated with `validateForm` or `schema.parse` — never raw `req.body`
- [ ] Auth resolved via DI: `req.container.resolve('auth')`
- [ ] Tests pass: `npm test`
- [ ] Lint passes: `npm run lint`

---

## See Also

- `/add-module` — Full module scaffolding with views, models, and Redux
- `/add-data` — Add models, migrations, and seeds
- `/add-test` — Add tests for the new route/controller
- `/modify` — Modify existing routes with test verification
- `/audit-security` — Audit the new route for security compliance
