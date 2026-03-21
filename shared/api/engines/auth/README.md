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

### Authentication

#### `requireAuth(options?)`

Validates JWT token from cookie or `Authorization` header. Populates `req.user`, `req.token`, `req.authenticated`. Supports pluggable strategies via `auth.strategy.{type}` hook.

| Option | Type | Default | Description |
|---|---|---|---|
| `tokenType` | `string` | `'access'` | Expected token type |
| `sources` | `string[]` | `['cookie', 'header']` | Token extraction sources |
| `includeUser` | `boolean` | `true` | Decode and attach user to `req.user` |
| `onError` | `function` | — | Custom error handler `(error, req, res, next)` |

#### `optionalAuth(options?)`

Same as `requireAuth` but continues without error if no token or invalid. Sets `req.authenticated = false` on failure.

#### `refreshToken(options?)`

Auto-refreshes expired/near-expiry access tokens using the refresh token cookie. **Non-blocking** — never fails the request.

| Option | Type | Default | Description |
|---|---|---|---|
| `refreshThreshold` | `number` | `300` (5 min) | Seconds before expiry to trigger refresh |
| `autoRefresh` | `boolean` | `true` | Auto-refresh expired tokens |
| `onRefresh` | `function` | — | Callback `(req, res, newTokens)` |

Sets `X-Auth-Status` header: `valid` | `refreshed` | `expired` | `needs-refresh` | `refresh-failed` | `guest` | `error`.

### Permissions

#### `requirePermission(...permissions)` / `requireAnyPermission(...permissions)`

Checks user has **ALL** or **ANY** listed permissions. Admin role bypasses by default.

```javascript
requirePermission('users:read');                                    // single
requirePermission('users:read', 'users:create');                    // ALL required
requireAnyPermission('posts:read', 'posts:moderate');               // ANY sufficient
requirePermission({ permissions: ['a:b'], adminBypass: false });    // disable bypass
```

Supports wildcards: `*:*` (super admin), `users:*` (resource wildcard), `*:read` (action wildcard).

### Roles

#### `requireRole(...roles)` / `requireAnyRole(...roles)`

Checks user has **ALL** or **ANY** listed roles. Admin bypass disabled by default.

```javascript
requireRole('admin');
requireAnyRole('admin', 'moderator');
requireRole({ roles: ['mod'], adminBypass: true });
```

#### `requireRoleLevel(minimumRole, hierarchy, options?)`

Hierarchy-based minimum level check.

```javascript
const hierarchy = ['viewer', 'editor', 'moderator', 'admin'];
requireRoleLevel('moderator', hierarchy); // 'moderator' or 'admin' required
```

#### `requireDynamicRole({ resolver?, resourceType?, matchAll? })`

Runtime-resolved roles via function or `auth.dynamic_roles` hook.

```javascript
requireDynamicRole({
  resolver: async (req) => {
    const project = await Project.findByPk(req.params.id);
    return project.editRole; // e.g. 'editor'
  },
});
```

### Groups

#### `requireGroup(...groups)` / `requireAnyGroup(...groups)` / `requireGroupLevel(min, hierarchy)`

Same pattern as roles. Admin bypass enabled by default.

### Ownership

#### `requireOwnership(options?)`

Param-based (`req.params.userId === req.user.id`) or hook-based (`auth.ownership` → `req.isOwner`).

```javascript
requireOwnership();                                    // param: 'userId'
requireOwnership({ param: 'authorId' });               // custom param
requireOwnership({ resourceType: 'post' });            // hook-based
```

#### `requireFlexibleOwnership({ strategies })` / `requireSharedOwnership({ resourceType })` / `requireHierarchicalOwnership({ resourceType })` / `requireTimeBasedOwnership({ resourceType, windowMs })`

Advanced ownership: multi-strategy, collaborative, hierarchy chain, and time-windowed access.

```javascript
// Allow if user owns post OR is team lead
requireFlexibleOwnership({
  strategies: [
    { param: 'id', resourceType: 'post' },
    { param: 'id', resourceType: 'team_post' },
  ],
});

// Shared ownership — user in collaborators
requireSharedOwnership({ resourceType: 'document' });

// Time-windowed — edit within 24h of creation
requireTimeBasedOwnership({ resourceType: 'post', windowMs: 24 * 60 * 60 * 1000 });
```

## Cookie Utilities

```javascript
import { setTokenCookie, getTokenFromCookie, clearAllAuthCookies, extractToken } from '@shared/api/engines/auth';

setTokenCookie(res, jwtToken);           // Set id_token (7 days)
setRefreshTokenCookie(res, refreshToken); // Set refresh_token (30 days)
const token = getTokenFromCookie(req);
clearAllAuthCookies(res);
const token = extractToken(req, { sources: ['cookie', 'header', 'query'] });
```

| Cookie | Name | Max Age |
|---|---|---|
| JWT | `id_token` | 7 days |
| Refresh | `refresh_token` | 30 days |

Config: `httpOnly`, `secure` (production only), `sameSite: 'lax'`, `path: '/'`.

## RBAC Constants

```javascript
import { ADMIN_ROLE, DEFAULT_ROLE, SYSTEM_PERMISSIONS, DEFAULT_RESOURCES, DEFAULT_ACTIONS } from '@shared/api/engines/auth';
```

| Constant | Value |
|---|---|
| `DEFAULT_ROLE` | `'user'` |
| `ADMIN_ROLE` | `'admin'` |
| `MODERATOR_ROLE` | `'mod'` |
| `DEFAULT_GROUP` | `'users'` |
| `ADMIN_GROUP` | `'administrators'` |

Permission format: `resource:action` (e.g., `users:read`, `extensions:delete`, `*:*`).

Resources: `users`, `roles`, `groups`, `permissions`, `apiKeys`, `nodered`, `files`, `emails`, `webhooks`, `activities`, `extensions`.

Actions: `create`, `read`, `update`, `delete`, `impersonate`, `*` (manage).

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
