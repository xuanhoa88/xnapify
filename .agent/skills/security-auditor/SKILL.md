---
name: security-auditor
description: Audit routes, controllers, and inputs for security compliance. Checks Zod validation, RBAC guards, and env var conventions.
---

# Security Auditor Skill

When reviewing or generating code, enforce these security checks automatically.

## Checklist

### 1. Input Validation

Every `req.body`, `req.query`, and `req.params` **must** be validated using Zod from `@shared/validator`.

**Check for:**

- Controller functions that access `req.body` without validation
- Missing schema imports from the module's `validator/` directory
- Raw `req.params.id` usage without type coercion

**Correct pattern:**

```javascript
import { z } from '@shared/validator';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
});

export async function create(req, res, next) {
  const data = schema.parse(req.body); // Throws on invalid input
  // ... use validated `data`, never raw `req.body`
}
```

### 2. Route Protection

Every API route **must** have RBAC guards unless explicitly public.

**Check for:**

- `_route.js` files with exported methods (`get`, `post`, etc.) that are plain functions without middleware chains
- Missing `requireAuth` or `requirePermission` in method export arrays
- Admin routes without permission checks

**Correct pattern:**

```javascript
// _route.js
function requirePermission(perm) {
  return (req, res, next) => {
    const auth = req.container.resolve('auth');
    return auth.middlewares.requirePermission(perm)(req, res, next);
  };
}

export const get = [requirePermission('resource:read'), controller.list];
export const post = [requirePermission('resource:create'), controller.create];
```

**Exception:** Public routes (login, registration, health checks) must explicitly opt out with `export const middleware = false;` and a comment explaining why.

### 3. Environment Variables

- All custom env vars **must** use the `XNAPIFY_` prefix
- Secrets must never be hardcoded — always use `process.env.XNAPIFY_*`
- New env vars must be added to `.env.xnapify` template with a comment

**Check for:**

- Hardcoded secrets, API keys, or tokens in source code
- `process.env.SOMETHING` without the `XNAPIFY_` prefix (except `NODE_ENV`)
- Missing entries in `.env.xnapify`

### 4. SQL Injection Prevention

- **No raw SQL** unless wrapping in `sequelize.literal()` with parameter binding
- Always use Sequelize ORM methods: `findAll`, `findByPk`, `create`, `update`, `destroy`
- Never interpolate user input into query strings

### 5. Cross-Module Isolation

- Modules (`@apps/*`) must **not** import directly from other modules
- Use hooks, container bindings, or extension slots for cross-module communication

**Check for:**

- `import ... from '@apps/other-module/...'` patterns
- Direct file references across module boundaries

### 6. Rate Limiting

All API routes are rate-limited by default (config via `app.set('rateLimitConfig')`). Routes can opt out or customize via exports in `_route.js`.

**Check for:**

- Routes serving static/immutable assets without `export const useRateLimit = false` — these can easily exceed limits on page load
- High-traffic endpoints without custom limits: `export const useRateLimit = { max: 200, windowMs: 60_000 }`
- Hardcoded rate limit bypasses in middleware (use the declarative `useRateLimit` export instead)

**Correct pattern:**

```javascript
// Skip rate limiting (static assets)
export const useRateLimit = false;

// Custom per-route limit
export const useRateLimit = { max: 200, windowMs: 60_000 };

// Default — omit the export entirely
```

## When to Apply

- After generating any new API route or controller
- When reviewing PRs or code changes
- During `/update-code` workflow execution
- When a developer asks to "add an endpoint" or "create a route"
