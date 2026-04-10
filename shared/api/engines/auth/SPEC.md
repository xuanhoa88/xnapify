# Auth Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Auth Engine at `shared/api/engines/auth`.
> This engine provides JWT authentication, RBAC authorization, cookie management, and Express middleware guards.

---

## Objective

Provide a composable authentication and authorization layer that can be applied to Express routes via middleware chaining. Supports JWT tokens, RBAC permissions/roles/groups, resource ownership, and secure cookie management.

## 1. Architecture

```
shared/api/engines/auth/
├── index.js              # Re-exports cookies, middlewares, constants
├── constants.js          # RBAC roles, groups, permissions, resources, actions
├── cookies.js            # Cookie set/get/clear + token extraction
├── middlewares/
│   ├── index.js          # Re-exports all middleware
│   ├── requireAuth.js    # JWT authentication (cache + strategy hooks)
│   ├── optionalAuth.js   # Optional JWT (no-fail)
│   ├── refreshToken.js   # Auto token refresh (7 status states)
│   ├── requirePermission.js  # Permission checks (ALL/ANY + wildcards)
│   ├── requireRole.js    # Role checks (ALL/ANY/level/dynamic)
│   ├── requireGroup.js   # Group checks (ALL/ANY/level)
│   └── requireOwnership.js   # Ownership checks (5 strategies)
└── middlewares.test.js   # Jest test suite
```

### Dependencies

```
index.js → cookies.js, middlewares/*, constants.js
requireAuth/optionalAuth → cookies.js (extractToken), container.resolve('jwt'), container.resolve('hook')
refreshToken → cookies.js (extractToken, set/get/clear cookies), container.resolve('jwt')
requirePermission → constants.js (ADMIN_ROLE), container.resolve('hook')
requireRole → constants.js (ADMIN_ROLE), container.resolve('hook')
requireGroup → constants.js (ADMIN_ROLE), container.resolve('hook')
requireOwnership → constants.js (ADMIN_ROLE), container.resolve('hook')
```

## 2. Cookie Management (`cookies.js`)

### Default Cookie Config

```javascript
{ httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'lax', path: '/' }
```

### Cookie Types

| Type | Cookie Name | Max Age | Description |
|---|---|---|---|
| `jwt` | `id_token` | 7 days | Access token |
| `refresh` | `refresh_token` | 30 days | Refresh token |

### Internal Functions

| Function | Signature | Description |
|---|---|---|
| `setSecureCookie` | `(res, name, value, options?)` | Set httpOnly/secure/sameSite cookie |
| `clearSecureCookie` | `(res, name, options?)` | Clear cookie by name |
| `getCookieValue` | `(req, name) → string\|null` | Read cookie value |
| `hasCookie` | `(req, name) → boolean` | Check cookie exists with value |
| `manageCookie` | `(action, type, context, value?, options?)` | Unified dispatcher (set/get/clear/has) |

`manageCookie` validates all params, throws named errors: `InvalidParameterError`, `MissingResponseError`, `MissingRequestError`, `MissingCookieValueError`, `UnknownCookieActionError`.

### Exported Functions

| Function | Description |
|---|---|
| `setTokenCookie(res, token, options?)` | Set `id_token` cookie (7 days) |
| `getTokenFromCookie(req, options?)` | Read JWT from `id_token` cookie |
| `hasTokenCookie(req, options?)` | Check if `id_token` exists |
| `clearTokenCookie(res, options?)` | Clear `id_token` cookie |
| `setRefreshTokenCookie(res, token, options?)` | Set `refresh_token` cookie (30 days) |
| `getRefreshTokenFromCookie(req, options?)` | Read refresh token |
| `hasRefreshTokenCookie(req, options?)` | Check if refresh token exists |
| `clearRefreshTokenCookie(res, options?)` | Clear refresh token |
| `clearAllAuthCookies(res, options?)` | Clear all auth cookies (default: both) |
| `extractToken(req, options?)` | Extract token from multiple sources |

### Token Extraction (`extractToken`)

Searches sources in order. First non-null wins.

| Option | Default | Description |
|---|---|---|
| `sources` | `['cookie', 'header', 'query']` | Ordered sources |
| `headerName` | `'authorization'` | Header name |
| `headerPrefix` | `'Bearer '` | Prefix to strip |
| `queryParam` | `'token'` | Query param name |

## 3. RBAC Constants (`constants.js`)

### Roles

| Constant | Value | Description |
|---|---|---|
| `DEFAULT_ROLE` | `'user'` | Assigned to new users |
| `ADMIN_ROLE` | `'admin'` | Full system access |
| `MODERATOR_ROLE` | `'mod'` | Content moderation |
| `SYSTEM_ROLES` | `['user', 'admin', 'mod']` | Cannot be deleted |

### Groups

| Constant | Value | Description |
|---|---|---|
| `DEFAULT_GROUP` | `'users'` | Default user group |
| `ADMIN_GROUP` | `'administrators'` | System admins |
| `SYSTEM_GROUPS` | `['users', 'administrators']` | Cannot be deleted |

### Actions (`DEFAULT_ACTIONS`)

`MANAGE` (`*`), `CREATE`, `READ`, `UPDATE`, `DELETE`, `IMPERSONATE`.

### Resources (`DEFAULT_RESOURCES`)

`ALL` (`*`), `USERS`, `ROLES`, `GROUPS`, `PERMISSIONS`, `API_KEYS`, `NODE_RED`, `FILES`, `EMAILS`, `WEBHOOKS`, `ACTIVITIES`, `EXTENSIONS`.

### System Permissions (30 total)

Format: `{ resource, action, description }`. Covers: super admin (`*:*`), users (CRUD + impersonate), roles (CRUD), groups (CRUD), permissions (CRUD), Node-RED (admin/read), API keys (create/delete), files (CRUD), activities (read), extensions (CRUD).

## 4. Middleware: `requireAuth(options?)`

**Authentication — validates JWT token and populates user.**

| Option | Default | Description |
|---|---|---|
| `tokenType` | `'access'` | Expected token type |
| `sources` | `['cookie', 'header']` | Token extraction sources |
| `includeUser` | `true` | Decode and attach user |
| `onError` | — | Custom error handler `(error, req, res, next)` |

### Flow

1. Extract token via `extractToken(req, { sources })`.
2. Throw `TokenRequiredError` (401) if no token.
3. If `includeUser`:
   - Decode token (without verifying) to read `payload.type`.
   - If `auth.strategy.{payload.type}` hook registered → delegate to strategy.
   - Else: check JWT cache → or `jwt.verifyTypedToken(token, tokenType)` → cache result.
4. Set: `req.user`, `req.token`, `req.authenticated = true`, `req.authMethod = 'jwt'`.

### Error Codes

| Error Name | Code | Status |
|---|---|---|
| `TokenRequiredError` | `TOKEN_REQUIRED` | 401 |
| `InvalidTokenFormatError` | `TOKEN_INVALID` | 401 |
| `TokenExpiredError` | `TOKEN_EXPIRED` | 401 |
| other | `TOKEN_INVALID` | 401 |

## 5. Middleware: `optionalAuth(options?)`

Same flow as `requireAuth`. Differences:
- No token → calls `next()` without error.
- **All** errors caught silently → sets `req.authenticated = false`, calls `next()`.
- When `includeUser = false`, still verifies token signature (rejects forged/expired).

## 6. Middleware: `refreshToken(options?)`

**Non-blocking** — auto-refreshes tokens, never fails the request.

| Option | Default | Description |
|---|---|---|
| `refreshThreshold` | `300` (5 min) | Seconds before expiry to trigger refresh |
| `autoRefresh` | `true` | Auto-refresh expired tokens |
| `onRefresh` | — | Callback `(req, res, newTokens)` on successful refresh |

### Flow

1. No token → `X-Auth-Status: guest`, `next()`.
2. Check `jwt.isTokenExpired(token)` and `jwt.getTokenTimeLeft(token)`.
3. If needs refresh and `autoRefresh`:
   - Get refresh token from cookie.
   - Call `jwt.refreshTokenPair(refreshToken)` → set new cookies.
   - Set `req.tokenRefreshed = true`, `X-Auth-Status: refreshed`, `X-Token-Refreshed: true`.
4. On refresh error:
   - Token truly invalid (4 error types: `TokenExpiredError`, `InvalidTokenTypeError`, `InvalidTokenFormatError`, `JsonWebTokenError`) → clear cookies, `X-Auth-Status: expired`.
   - Transient error → keep cookies, `X-Auth-Status: refresh-failed`.
5. No refresh token + expired → `X-Auth-Status: needs-refresh`.
6. Token valid → `X-Auth-Status: valid`.
7. Unexpected errors → `X-Auth-Status: error`, continue.

### `X-Auth-Status` Values

`valid` | `refreshed` | `expired` | `needs-refresh` | `refresh-failed` | `guest` | `error`

## 7. Middleware: `requirePermission` / `requireAnyPermission`

**Use after `requireAuth`.** Checks resolved permissions.

| Middleware | Logic | Admin Bypass Default |
|---|---|---|
| `requirePermission(...perms)` | User must have **ALL** | `true` |
| `requireAnyPermission(...perms)` | User must have **ANY** | `true` |

### API Variants

```javascript
requirePermission('users:read');                                    // string args
requirePermission('users:read', 'users:write');                     // multiple
requirePermission({ permissions: ['a:b'], adminBypass: false });    // object config
```

### Wildcard Matching (`hasPermission`)

- `*:*` → super admin, matches everything
- `users:*` → matches all actions on `users` resource
- `*:read` → matches `read` action on all resources

### Resolution Flow

1. Check `req.user` exists → 401 if not.
2. Admin bypass: `req.user.is_admin === true` → skip (when enabled).
3. If `req.user.permissions` not populated → emit `auth.permissions` hook `'resolve'` event.
4. Check permissions via `hasPermission()`.

Error: `ForbiddenError` (403, code: `PERMISSION_DENIED`).

## 8. Middleware: Role Family

**Use after `requireAuth`.** Checks resolved roles.

| Middleware | Logic | Admin Bypass Default |
|---|---|---|
| `requireRole(...roles)` | User must have **ALL** | `false` |
| `requireAnyRole(...roles)` | User must have **ANY** | `false` |
| `requireRoleLevel(min, hierarchy, options?)` | User has role ≥ `min` in hierarchy | `false` |
| `requireDynamicRole(options)` | Runtime-resolved roles | — |

### `requireRoleLevel`

```javascript
const hierarchy = ['viewer', 'editor', 'moderator', 'admin'];
requireRoleLevel('moderator', hierarchy); // user must have 'moderator' or 'admin'
```

### `requireDynamicRole`

| Option | Description |
|---|---|
| `resolver` | `async (req) → string\|string[]` — returns required roles |
| `resourceType` | Uses `auth.dynamic_roles` hook to resolve `req.requiredRoles` |
| `matchAll` | `false` — if `true`, user must have ALL resolved roles |

### Resolution Flow

1. Check `req.user` exists → 401 if not.
2. If `req.user.roles` not populated → emit `auth.roles` hook `'resolve'` event.
3. Admin bypass (when enabled): `req.user.is_admin === true` → skip.

Error: `ForbiddenError` (403, codes: `ROLE_REQUIRED`, `ROLE_LEVEL_REQUIRED`, `DYNAMIC_ROLE_REQUIRED`).

## 9. Middleware: Group Family

**Use after `requireAuth`.** Same pattern as roles. Admin bypass default **ON**.

| Middleware | Logic |
|---|---|
| `requireGroup(...groups)` | User must belong to **ALL** |
| `requireAnyGroup(...groups)` | User must belong to **ANY** |
| `requireGroupLevel(min, hierarchy)` | User in group ≥ `min` in hierarchy |

Error: `ForbiddenError` (403, codes: `GROUP_REQUIRED`, `GROUP_LEVEL_REQUIRED`).

## 10. Middleware: Ownership Family

**Use after `requireAuth`.** All default to `adminBypass = true`.

### `requireOwnership(options?)`

| Option | Default | Description |
|---|---|---|
| `param` | `'userId'` | Route param containing owner ID |
| `userIdField` | `'id'` | Field on `req.user` |
| `adminBypass` | `true` | Admin skips check |
| `resourceType` | — | Triggers hook-based resolution |

**Resolution:** Hook-based (`auth.ownership` → sets `req.isOwner`) first, then param-based fallback.

### `requireFlexibleOwnership({ strategies, adminBypass? })`

Tries multiple `{ param, userIdField, resourceType }` strategies in order. First match grants access. Resets `req.isOwner` between strategies.

### `requireSharedOwnership({ resourceType, userIdField?, adminBypass? })`

Hook: `auth.shared_ownership` → module populates `req.sharedOwners` (array of user IDs). User must appear in array. Error code: `SHARED_OWNERSHIP_REQUIRED`.

### `requireHierarchicalOwnership({ resourceType, userIdField?, adminBypass? })`

Hook: `auth.hierarchical_ownership` → module populates `req.ownerChain` (array of user IDs from owner up to top-level). User must appear anywhere in chain. Error code: `HIERARCHICAL_OWNERSHIP_REQUIRED`.

### `requireTimeBasedOwnership({ resourceType, windowMs?, adminBypass? })`

Hook: `auth.time_based_ownership` → module sets `req.isOwner` and `req.ownershipExpiresAt`. Checks ownership first, then expiry. Error codes: `OWNERSHIP_REQUIRED`, `OWNERSHIP_EXPIRED`.

## 11. Hook Channels Summary

| Channel | Event | Purpose | Populated Field |
|---|---|---|---|
| `auth.permissions` | `resolve` | Resolve user permissions | `req.user.permissions` |
| `auth.roles` | `resolve` | Resolve user roles | `req.user.roles` |
| `auth.groups` | `resolve` | Resolve user groups | `req.user.groups` |
| `auth.ownership` | `resolve` | Resolve resource ownership | `req.isOwner` |
| `auth.shared_ownership` | `resolve` | Resolve shared owners | `req.sharedOwners` |
| `auth.hierarchical_ownership` | `resolve` | Resolve ownership chain | `req.ownerChain` |
| `auth.time_based_ownership` | `resolve` | Resolve timed ownership | `req.isOwner`, `req.ownershipExpiresAt` |
| `auth.dynamic_roles` | `resolve` | Resolve dynamic roles | `req.requiredRoles` |
| `auth.strategy.{type}` | `authenticate` | Pluggable auth strategies | `req.user` |

## 12. Error Responses

All RBAC middleware call `next(error)` with named errors:

| Error Name | Status | Code |
|---|---|---|
| `AuthenticationRequiredError` | 401 | `AUTH_REQUIRED` |
| `TokenRequiredError` | 401 | `TOKEN_REQUIRED` |
| `ForbiddenError` | 403 | varies per middleware |
| `ConfigurationError` | 500 | `INVALID_ROLE_CONFIG` / `INVALID_GROUP_CONFIG` |

`requireAuth` responds directly with JSON `{ success, error, code }` (does not call `next(error)`), unless `onError` is provided.

---

*Note: This spec reflects the CURRENT implementation of the auth engine.*
