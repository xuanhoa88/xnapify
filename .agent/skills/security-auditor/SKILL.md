---
name: security-auditor
description: Audit routes, controllers, inputs, extensions, and infrastructure for security compliance. Checks Zod validation, RBAC guards, CSP, integrity verification, path traversal, WebSocket auth, and env var conventions.
version: 2.0
priority: HIGH
---

# Security Auditor Skill

When reviewing or generating code, enforce these security checks automatically. This skill covers **10 security domains** specific to the xnapify architecture.

---

## Audit Procedure

### Step 1: Identify Attack Surface

| Code Area | What to Audit |
|-----------|---------------|
| `_route.js` files | RBAC guards, rate limiting, middleware opt-outs |
| Controller functions | Input validation, response formatting, error leaks |
| Service functions | SQL safety, path traversal, privilege escalation |
| Extension hooks | Isolation, IPC validation, integrity checks |
| WebSocket handlers | Token authentication, channel authorization |
| File operations | Path traversal, zip extraction, temp file cleanup |
| Environment config | Secret exposure, prefix compliance |

### Step 2: Run All Checklists

Apply every section below. Flag findings with severity:

| Severity | Meaning |
|----------|---------|
| 🔴 **CRITICAL** | Exploitable vulnerability — blocks merge |
| 🟡 **WARNING** | Potential vulnerability or missing defense-in-depth |
| 🟢 **SUGGESTION** | Hardening opportunity |

### Step 3: Report

Use the [Report Format](#report-format) at the bottom.

---

## 1. Input Validation

Every `req.body`, `req.query`, and `req.params` **must** be validated using Zod from `@shared/validator`.

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 Controller accesses `req.body` without validation | Must use `validateForm` or `schema.parse` |
| 🔴 Raw `req.params.id` used in DB query | Must coerce to expected type |
| 🟡 Missing schema import from `validator/` directory | Validation logic colocated with validators |
| 🟡 Schema allows `.passthrough()` or `.strip()` without justification | May pass unexpected fields to DB |

### Correct Patterns

**Pattern A: `validateForm` wrapper (preferred)**

```javascript
import { validateForm, z } from '@shared/validator';

const schema = extensionStatusSchema({ i18n, z });
const [isValid, result] = validateForm(() => schema, req.body);
if (!isValid) return http.sendValidationError(res, result);
// Use `result` (validated data), never raw `req.body`
```

**Pattern B: Direct `schema.parse` (simple cases)**

```javascript
import { z } from '@shared/validator';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
});

export async function create(req, res) {
  const data = schema.parse(req.body); // Throws ZodError on invalid input
  // Use `data`, never raw `req.body`
}
```

### Validation Schema Location

Schemas live in the module's `validator/` directory:

```
@apps/{module}/validator/
└── {resource}.js   # Export schema factories: (deps) => z.object({...})
```

---

## 2. Route Protection (RBAC)

Every API route **must** have RBAC guards unless explicitly public.

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 `_route.js` exports `get`/`post`/`put`/`delete` as plain functions | Must be middleware arrays: `[requirePermission('scope'), handler]` |
| 🔴 Admin route under `(admin)/` without permission check | All admin routes MUST have RBAC |
| 🔴 Auth imported directly instead of via DI | Must use `req.container.resolve('auth')` or `req.app.get('container').resolve('auth')` |
| 🟡 Public route without `export const middleware = false` + comment | Must be explicit about why no auth |

### Correct Pattern: API Route

```javascript
// _route.js — API route (backend)
function requirePermission(permission) {
  return (req, res, next) => {
    const { middlewares } = req.app.get('container').resolve('auth');
    return middlewares.requirePermission(permission)(req, res, next);
  };
}

export const get = [requirePermission('resource:read'), controller.list];
export const post = [requirePermission('resource:create'), controller.create];
export const put = [requirePermission('resource:update'), controller.update];
export const del = [requirePermission('resource:delete'), controller.remove];
```

### Correct Pattern: View Route

```javascript
// _route.js — View route (frontend)
import { requirePermission } from '@shared/renderer/components/Rbac';

export const middleware = requirePermission('resource:read');
```

### Public Route Exemption

Routes without auth MUST document why:

```javascript
/**
 * Inbound webhook — uses HMAC signature verification instead of JWT.
 */
export const middleware = false;
```

Legitimate exemptions:
- Webhook receivers (use HMAC verification)
- Login / registration endpoints
- Health check endpoints
- Public static asset routes
- OAuth callback handlers

---

## 3. Environment Variables

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 Hardcoded secret, API key, or token in source code | Must use `process.env.XNAPIFY_*` |
| 🔴 `process.env.SOMETHING` without `XNAPIFY_` prefix | All custom vars must be prefixed (exceptions: `NODE_ENV`, `DEBUG`, `PORT`) |
| 🟡 New env var not added to `.env.xnapify` template | Must document with comment |
| 🟡 Secret logged or included in error responses | Never log secrets, even in `__DEV__` mode |

### Allowed Non-Prefixed Vars

| Variable | Why |
|----------|-----|
| `NODE_ENV` | Node.js standard |
| `DEBUG` | Debug logging namespace |
| `PORT` | Cloud platform convention (but prefer `XNAPIFY_PORT`) |
| `DATABASE_URL` | Database adapter convention |

---

## 4. SQL Injection Prevention

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 String concatenation in SQL query | `sequelize.query(\`... ${userInput} ...\`)` |
| 🔴 User input in `sequelize.literal()` without parameter binding | Must use `sequelize.literal('?', [value])` |
| 🟡 `Op.like` with unescaped user input | `%` and `_` are SQL wildcards — escape them |
| 🟢 Using ORM methods correctly | `findAll`, `findByPk`, `create`, `update`, `destroy` |

### Correct Pattern

```javascript
// ORM methods (preferred — no injection risk)
const users = await User.findAll({
  where: { email: validatedEmail },
  limit: 10,
});

// Raw query with parameter binding (when ORM is insufficient)
const [results] = await sequelize.query(
  'SELECT * FROM users WHERE email = ?',
  { replacements: [validatedEmail] },
);
```

---

## 5. Cross-Module Isolation

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 `import ... from '@apps/other-module/...'` | Cross-domain static import |
| 🔴 Extension directly modifying `src/apps/` files | Violates extension encapsulation |
| 🟡 Direct file references across module boundaries | Use DI `container.resolve()` or hook system |

### Correct Cross-Module Communication

```javascript
// ✅ DI resolution
const emailService = container.resolve('emails:send');

// ✅ Hook system
const hook = container.resolve('hook');
hook('emails').emit('send', { to, slug, html, data });

// ❌ Direct import (BLOCKED)
import { sendEmail } from '@apps/emails/api/services/email.service';
```

---

## 6. Rate Limiting

All API routes are rate-limited by default via `app.set('rateLimitConfig')`.

### What to Check

| Check | Description |
|-------|-------------|
| 🟡 Static asset route without `export const useRateLimit = false` | Page loads fetch many assets, easily hitting limits |
| 🟡 High-traffic endpoint without custom limits | Should declare `export const useRateLimit = { max: 200, windowMs: 60_000 }` |
| 🟡 Hardcoded rate limit bypass in middleware | Use declarative `useRateLimit` export instead |
| 🟢 Login/auth endpoints with default limits | Consider stricter limits to prevent brute force |

### Correct Patterns

```javascript
// Skip rate limiting (static assets, extension static files)
export const useRateLimit = false;

// Custom per-route limit (high-traffic endpoint)
export const useRateLimit = { max: 200, windowMs: 60_000 };

// Strict limit (login endpoint — anti-brute-force)
export const useRateLimit = { max: 10, windowMs: 60_000 };

// Default — omit the export entirely (uses app-wide config)
```

---

## 7. Path Traversal Prevention

File operations MUST guard against directory escape.

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 `path.join(baseDir, userInput)` without traversal guard | Attacker can use `../../etc/passwd` |
| 🔴 `fs.readFile(req.params.path)` directly | Must validate resolved path stays within base |
| 🔴 Zip extraction to arbitrary path | Must validate extracted file paths |
| 🟡 `path.resolve()` without checking against base directory | May escape base when input contains `..` |

### Correct Pattern

```javascript
const pDir = path.join(baseDir, userInput);
const relative = path.relative(baseDir, pDir);

// Guard: relative path must not escape base directory
if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
  await fs.promises.rm(pDir, { recursive: true, force: true });
} else {
  throw new Error('Path traversal detected');
}
```

### File Upload Validation

```javascript
// Validate extracted manifest location after zip extraction
const manifestPath = path.join(extensionRoot, 'package.json');
const resolvedManifest = path.resolve(manifestPath);
if (!resolvedManifest.startsWith(path.resolve(extensionRoot))) {
  throw ExtensionError.invalidPackage('Path traversal in zip archive');
}
```

---

## 8. Extension Security

Extensions run third-party code inside the application. Special security measures apply.

### 8.1 Integrity Verification

| Check | Description |
|-------|-------------|
| 🔴 Extension activated without integrity check | Must verify SHA-256 hash before activation (non-dev only) |
| 🔴 Integrity hash never recomputed after dependency install | Must recompute after `npm install` |
| 🟡 Dev extensions skip integrity checks | Expected — but flag if running in production |

### Correct Flow

```
Install → computeChecksum → store hash in DB
Activate → verifyChecksum(storedHash) → reject on mismatch
         → npm install → recomputeChecksum → update DB
```

### 8.2 Extension Isolation

| Check | Description |
|-------|-------------|
| 🔴 Extension imports from `src/apps/` | Must use hooks, slots, or IPC |
| 🔴 IPC handler uses raw string for hook ID | Must use `__EXTENSION_ID__` compile-time constant |
| 🟡 Extension `boot()` registers handlers without `shutdown()` cleanup | Memory leak — also a stability issue |
| 🟡 Extension `install()`/`uninstall()` without `try/catch` | Unguarded DB ops during sensitive state transitions |

### 8.3 Tamper Detection

When integrity verification fails:
1. Force-deactivate the extension: `extension.update({ is_active: false })`
2. Send WS notification: `notifyExtensionChange(container, 'EXTENSION_TAMPERED', extensionKey)`
3. Log detailed error with expected vs actual hash

---

## 9. Content Security Policy (CSP)

xnapify uses per-request nonce-based CSP in production.

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 Inline `<script>` without `nonce` attribute | Blocked by CSP: `script-src 'self' 'nonce-{nonce}'` |
| 🔴 `eval()` or `new Function()` in client code | Blocked by default CSP |
| 🟡 Extension injecting inline scripts | Must include `nonce` attribute from `req.cspNonce` |
| 🟡 Third-party script CDN not in CSP `script-src` | Must add domain to `buildCspHeader()` |

### CSP Directives (Production)

```
default-src 'self'
script-src  'self' 'nonce-{per-request}'
style-src   'self' 'unsafe-inline'
img-src     'self' https: data: blob:
font-src    'self' data:
connect-src 'self' ws: wss:
```

### Static Security Headers

These are always set (not configurable):

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

---

## 10. WebSocket Security

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 WS connection accepts without token validation | Must verify JWT via `validateWsToken()` |
| 🟡 Sensitive data in public WS channel | Use authenticated channels for user-specific data |
| 🟡 WS event handler without input validation | Treat WS payloads as untrusted input |

### Architecture

- `sendToPublicChannel('channel', payload)` — broadcasts to all connected clients (no auth required for receiving)
- Token-based auth on connection upgrade via `validateWsToken(jwt, token)`
- Token cache via `jwt.cache.get(token)` to avoid redundant crypto

---

## 11. Cookie Security

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 Cookie without `httpOnly: true` | Prevents XSS cookie theft |
| 🔴 Cookie without `secure: true` in production | Prevents MITM cookie interception |
| 🟡 Cookie without `sameSite: 'lax'` or `'strict'` | Prevents CSRF |
| 🟡 Oversized cookies accepted | Must validate against `maxCookieSize` (DoS protection) |

### Correct Cookie Config

```javascript
{
  httpOnly: true,
  secure: !__DEV__,
  sameSite: 'lax',
  path: '/',
  maxAge: LOCALE_COOKIE_MAX_AGE * 1000,
}
```

---

## 12. Error Information Leakage

### What to Check

| Check | Description |
|-------|-------------|
| 🔴 Stack trace in production error response | Use `__DEV__ ? err.message : 'Internal server error'` |
| 🔴 Database column names in error messages | Use generic error messages for clients |
| 🟡 Detailed error in `http.sendServerError` | Third arg (err) should only be logged server-side |
| 🟢 Request ID in error responses | Good — enables log correlation without leaking internals |

### Correct Pattern

```javascript
// Controller: message is user-facing, err is logged server-side only
return http.sendServerError(res, 'Failed to list extensions', err);

// Error middleware: conditional based on environment
res.status(status).json({
  status,
  success: false,
  error: __DEV__ ? err.message : 'Internal server error',
  requestId: req.id,
});
```

---

## When to Apply This Skill

| Trigger | Action |
|---------|--------|
| New API route or controller created | Full audit (sections 1–6, 12) |
| New extension developed | Extension security audit (section 8) |
| File upload/download feature | Path traversal audit (section 7) |
| WebSocket handler added | WS security audit (section 10) |
| PR review or `/update-code` workflow | Full audit |
| Environment variable added | Env var audit (section 3) |
| CSP violation reported | CSP audit (section 9) |

---

## Report Format

```markdown
# Security Audit: [module/component name]

## Summary
[1-2 sentence risk assessment]

## Findings

### Input Validation
- 🔴 [file:line] req.body accessed without Zod validation. Fix: add `validateForm`.

### Route Protection
- ✅ All admin routes have RBAC guards.

### Extension Security
- 🟡 [file:line] boot() registers 3 hooks but shutdown() only unregisters 2.

### Path Traversal
- ✅ All file operations use relative path guard.

## Risk Level
**LOW** | **MEDIUM** | **HIGH** | **CRITICAL**
```

| Risk Level | When |
|------------|------|
| **LOW** | No 🔴, 0–2 🟡 |
| **MEDIUM** | No 🔴, 3+ 🟡 |
| **HIGH** | 1 🔴 |
| **CRITICAL** | 2+ 🔴 or any exploitable vulnerability |
