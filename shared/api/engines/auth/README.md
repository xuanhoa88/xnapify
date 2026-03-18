# Auth Engine

Authentication, authorization, and cookie management for Express routes. Provides JWT-based auth middleware, RBAC permission/role/group checks, ownership verification, and secure cookie utilities.

## Quick Start

```javascript
import { middlewares } from '@shared/api/engines/auth';

// Protect a route — require valid JWT
router.get('/profile', middlewares.requireAuth(), controller.profile);

// Require a specific permission
router.get('/users', middlewares.requirePermission('users:read'), controller.list);

// Require a specific role
router.delete('/posts/:id', middlewares.requireRole('admin'), controller.delete);
```

## Middlewares

### `requireAuth(options?)`

Validates JWT token from cookie or `Authorization` header. Populates `req.user`, `req.token`, `req.authenticated`. Supports pluggable strategies via `auth.strategy.{type}` hook.

| Option | Type | Default | Description |
|---|---|---|---|
| `tokenType` | `string` | `'access'` | Expected token type |
| `sources` | `string[]` | `['cookie', 'header']` | Token extraction sources |
| `includeUser` | `boolean` | `true` | Decode and attach user to `req.user` |

### `optionalAuth(options?)`

Same as `requireAuth` but continues without error if no token is present. Sets `req.authenticated = false` on failure.

### `refreshToken(options?)`

Auto-refreshes expired/near-expiry access tokens using the refresh token cookie. Sets `X-Auth-Status` response header.

| Option | Type | Default | Description |
|---|---|---|---|
| `refreshThreshold` | `number` | `300` (5 min) | Seconds before expiry to trigger refresh |
| `autoRefresh` | `boolean` | `true` | Auto-refresh expired tokens |

### `requirePermission(...permissions)`

Checks user has **ALL** listed permissions. Supports wildcard matching (`*:*`, `users:*`, `*:read`). Admin role bypasses by default.

```javascript
router.get('/users', requirePermission('users:read'), handler);
router.post('/users', requirePermission('users:read', 'users:create'), handler);
```

### `requireAnyPermission(...permissions)`

Checks user has **ANY** of the listed permissions.

### `requireRole(...roles)`

Checks user has **ALL** listed roles. Supports `adminBypass` option.

### `requireAnyRole(...roles)` / `requireRoleLevel(minimumRole, hierarchy)` / `requireDynamicRole(options)`

Flexible role checks — any-match, hierarchy-based levels, and runtime-resolved roles.

### `requireOwnership(options?)`

Checks user owns the resource via param comparison (`req.params.userId === req.user.id`) or hook-based resolution (`auth.ownership`).

### `requireFlexibleOwnership({ strategies })` / `requireSharedOwnership({ resourceType })` / `requireHierarchicalOwnership({ resourceType })` / `requireTimeBasedOwnership({ resourceType, windowMs })`

Advanced ownership patterns: multi-strategy, collaborative, hierarchy chain, and time-windowed access.

## Cookie Utilities

```javascript
import { setTokenCookie, getTokenFromCookie, clearAllAuthCookies } from '@shared/api/engines/auth';

setTokenCookie(res, jwtToken);
const token = getTokenFromCookie(req);
clearAllAuthCookies(res);
```

| Function | Description |
|---|---|
| `setTokenCookie(res, token)` | Set JWT `id_token` cookie (7 days) |
| `getTokenFromCookie(req)` | Read JWT from cookie |
| `clearTokenCookie(res)` | Clear JWT cookie |
| `setRefreshTokenCookie(res, token)` | Set `refresh_token` cookie (30 days) |
| `getRefreshTokenFromCookie(req)` | Read refresh token from cookie |
| `clearAllAuthCookies(res)` | Clear all auth cookies |
| `extractToken(req, options?)` | Extract token from cookie, header, or query |

## RBAC Constants

```javascript
import { ADMIN_ROLE, DEFAULT_ROLE, SYSTEM_PERMISSIONS, DEFAULT_RESOURCES } from '@shared/api/engines/auth';
```

| Constant | Value |
|---|---|
| `DEFAULT_ROLE` | `'user'` |
| `ADMIN_ROLE` | `'admin'` |
| `MODERATOR_ROLE` | `'mod'` |
| `SYSTEM_ROLES` | `['user', 'admin', 'mod']` |
| `DEFAULT_GROUP` | `'users'` |
| `ADMIN_GROUP` | `'administrators'` |

Permission format: `resource:action` (e.g., `users:read`, `plugins:delete`).

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
