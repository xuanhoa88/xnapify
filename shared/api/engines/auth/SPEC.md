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
├── constants.js          # RBAC roles, groups, permissions
├── cookies.js            # Cookie set/get/clear + token extraction
├── middlewares/
│   ├── index.js          # Re-exports all middleware
│   ├── requireAuth.js    # JWT authentication
│   ├── optionalAuth.js   # Optional JWT (no-fail)
│   ├── refreshToken.js   # Auto token refresh
│   ├── requirePermission.js  # Permission checks (ALL/ANY)
│   ├── requireRole.js    # Role checks (ALL/ANY/level/dynamic)
│   ├── requireGroup.js   # Group checks (ALL/ANY/level)
│   └── requireOwnership.js   # Ownership checks (param/hook/shared/hierarchical/time)
└── middlewares.test.js   # Jest test suite
```

## 2. Cookie Management (`cookies.js`)

### Internal Functions

- `setSecureCookie(res, name, value, options)` — Sets httpOnly, secure, sameSite cookie.
- `clearSecureCookie(res, name, options)` — Clears a cookie by name.
- `getCookieValue(req, name)` → `string|null`
- `hasCookie(req, name)` → `boolean`
- `manageCookie(action, type, context, value?, options?)` — Unified dispatcher for set/get/clear/has.

### Cookie Types (predefined)

| Type | Cookie Name | Max Age |
|---|---|---|
| `jwt` | `id_token` | 7 days |
| `refresh` | `refresh_token` | 30 days |

### Exported Functions

`setTokenCookie`, `getTokenFromCookie`, `hasTokenCookie`, `clearTokenCookie`, `setRefreshTokenCookie`, `hasRefreshTokenCookie`, `getRefreshTokenFromCookie`, `clearRefreshTokenCookie`, `clearAllAuthCookies`, `extractToken`.

### Token Extraction (`extractToken`)

Searches sources in order: `cookie` → `header` → `query`. Configurable via `sources`, `headerName`, `headerPrefix`, `queryParam` options.

## 3. RBAC Constants (`constants.js`)

### Roles

`DEFAULT_ROLE` (`user`), `ADMIN_ROLE` (`admin`), `MODERATOR_ROLE` (`mod`), `SYSTEM_ROLES`.

### Groups

`DEFAULT_GROUP` (`users`), `ADMIN_GROUP` (`administrators`), `SYSTEM_GROUPS`.

### Permissions

Format: `{ resource, action, description }`. Standard actions: `create`, `read`, `update`, `delete`, `impersonate`, `*` (manage). Resources: `users`, `roles`, `groups`, `permissions`, `apiKeys`, `nodered`, `files`, `emails`, `webhooks`, `activities`, `plugins`.

## 4. Middleware: `requireAuth`

- Extracts token via `extractToken`.
- Checks JWT cache (`jwt.cache.get`) before crypto verification.
- Supports pluggable auth strategies via `auth.strategy.{payload.type}` hook channel.
- Standard flow: `jwt.verifyTypedToken(token, tokenType)` → cache result.
- Sets: `req.user`, `req.token`, `req.authenticated`, `req.authMethod`.

## 5. Middleware: `optionalAuth`

Same as `requireAuth` but catches all errors silently — sets `req.authenticated = false` and calls `next()`.

## 6. Middleware: `refreshToken`

- Checks if token is expired or near expiry (`refreshThreshold`, default 5 min).
- Uses `jwt.refreshTokenPair(existingRefreshToken)` to issue new access + refresh tokens.
- Sets response headers: `X-Auth-Status` (`valid`, `refreshed`, `expired`, `needs-refresh`, `refresh-failed`, `guest`, `error`).
- Only clears cookies for explicitly invalid tokens (`TokenExpiredError`, `InvalidTokenTypeError`, `InvalidTokenFormatError`, `JsonWebTokenError`).

## 7. Middleware: `requirePermission` / `requireAnyPermission`

- Hook channel: `auth.permissions` — modules populate `req.user.permissions` via `resolve` event.
- Admin bypass: `req.user.roles.includes('admin')` skips checks (default enabled).
- Wildcard matching via `hasPermission()`: `*:*`, `users:*`, `*:read`.
- `requirePermission`: user must have ALL listed permissions.
- `requireAnyPermission`: user must have ANY listed permission.

## 8. Middleware: `requireRole` / `requireAnyRole` / `requireRoleLevel` / `requireDynamicRole`

- Hook channel: `auth.roles` — modules populate `req.user.roles` via `resolve` event.
- `requireRole`: user must have ALL listed roles.
- `requireAnyRole`: user must have ANY listed role.
- `requireRoleLevel(minimumRole, hierarchy)`: hierarchy-based minimum level check.
- `requireDynamicRole({ resolver?, resourceType? })`: runtime-resolved roles via function or `auth.dynamic_roles` hook.

## 9. Middleware: `requireGroup` / `requireAnyGroup` / `requireGroupLevel`

- Hook channel: `auth.groups` — modules populate `req.user.groups` via `resolve` event.
- Same pattern as roles: ALL, ANY, and hierarchy-level checks.

## 10. Middleware: Ownership Family

### `requireOwnership(options?)`

- Param-based: `req.params[param] === req.user[userIdField]`.
- Hook-based: emits `auth.ownership` → `resolve` event, module sets `req.isOwner`.

### `requireFlexibleOwnership({ strategies })`

Tries multiple strategies in order — first match grants access.

### `requireSharedOwnership({ resourceType })`

Hook channel: `auth.shared_ownership` → module populates `req.sharedOwners` array.

### `requireHierarchicalOwnership({ resourceType })`

Hook channel: `auth.hierarchical_ownership` → module populates `req.ownerChain` array. User must appear anywhere in the chain.

### `requireTimeBasedOwnership({ resourceType, windowMs })`

Hook channel: `auth.time_based_ownership` → module sets `req.isOwner` and `req.ownershipExpiresAt`. Access denied if window expired.

## 11. Hook Channels Summary

| Channel | Purpose | Populated Field |
|---|---|---|
| `auth.permissions` | Resolve user permissions | `req.user.permissions` |
| `auth.roles` | Resolve user roles | `req.user.roles` |
| `auth.groups` | Resolve user groups | `req.user.groups` |
| `auth.ownership` | Resolve resource ownership | `req.isOwner` |
| `auth.shared_ownership` | Resolve shared owners | `req.sharedOwners` |
| `auth.hierarchical_ownership` | Resolve ownership chain | `req.ownerChain` |
| `auth.time_based_ownership` | Resolve timed ownership | `req.isOwner`, `req.ownershipExpiresAt` |
| `auth.dynamic_roles` | Resolve dynamic roles | `req.requiredRoles` |
| `auth.strategy.{type}` | Pluggable auth strategies | `req.user` |

---

*Note: This spec reflects the CURRENT implementation of the auth engine.*
