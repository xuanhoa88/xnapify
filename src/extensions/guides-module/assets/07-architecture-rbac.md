---
id: architecture-rbac
title: Role-Based Access Control (RBAC)
sidebar_position: 7
---

# Role-Based Access Control (RBAC)

**xnapify** implements a robust, centralized Role-Based Access Control system to govern multi-tenant setups, organizational security, and endpoint authorization across the core App modules and modular extensions uniformly.

---

## 1. Core Model Structure

The RBAC system relies on an interconnected entity mapping that establishes permissions additively:

1. **User (Users Module):** The primary identity interacting with the system.
2. **Roles (Roles Module):** A classification holding distinct capabilities (e.g. `System Admin`, `Author`).
3. **Permissions (Roles Module):** Granular access string tuples formatted as `resource:action` (e.g. `users:read`, `settings:update`).
4. **Groups (Groups Module):** Organizational silos. A Group can hold numerous Users and map Roles applicable to the entire Group simultaneously.

### The Resolution Pipeline

When evaluating an operation, a User's cumulative permissions are calculated dynamically utilizing:
`User -> Assigned Roles -> Permissions`
**UNION**
`User -> Assigned Groups -> Group Roles -> Permissions`

Instead of hitting the SQL Database recursively upon every single API request to parse this relational tree structurally, the aggregated snapshot is cached intelligently utilizing a Redis-backed (or purely internal-memory) `rbacCache`. A cache invalidation hook is emitted on any structural modification to User, Group, or Roles matrices globally to ensure 0-day latency when revoking authorization.

---

## 2. Server Authorization (API Layer)

Instead of relying on statically imported middlewares that tightly couple modules to the auth system, backend routes dynamically retrieve the `requirePermission` middleware from the Dependency Injection (DI) system at request-time. This decoupling is essential for the engine architecture.

```javascript
/* src/apps/files/api/routes/(admin)/(default)/_route.js */

import * as fileController from '../../../controllers/admin/files.controller';

/**
 * Dynamically resolves the auth engine to prevent static module coupling
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const { middlewares } = req.app.get('container').resolve('auth');
    return middlewares.requirePermission(permission)(req, res, next);
  };
}

// Guards the endpoint, responding with HTTP 403 if unauthorized
export const get = [requirePermission('files:read'), fileController.getFiles];

export const post = [
  requirePermission('files:create'),
  fileController.uploadFile,
];
```

---

## 3. Client React UI Authorization

Exposing frontend React User Interfaces depends on evaluating the logged-in User's active JWT payload state globally managed by Redux.

### Conditionally Rendering Elements

To obscure functionality logically impossible for unauthorized users, `xnapify` ships a centralized wrapper component utilizing Context evaluation:

```javascript
import { RbacGuard } from '@shared/renderer/components/Rbac';

export default function AdministrativePanel() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Standard Element Evaluation */}
      <RbacGuard permission='users:read'>
        <UserListingTable />
      </RbacGuard>

      {/* Fallback Rendering Pattern */}
      <RbacGuard
        permission='users:delete'
        fallback={<button disabled>Delete (Unauthorized)</button>}
      >
        <button color='danger'>Delete System Core</button>
      </RbacGuard>
    </div>
  );
}
```

### Route-Level UI Barriers

Entire React structural subtrees (i.e., Page routes) can be blocked utilizing Frontend Routing middlewares ensuring Javascript boundaries aren't bypassed.

```javascript
/* src/apps/settings/views/_route.js */

import { requirePermission } from '@shared/renderer/components/Rbac';

// Evaluated by the SSR and Client Routers prior to triggering React
export const middleware = requirePermission('settings:update');

export default function SettingsView() {
  return <div>Only Admins See This String</div>;
}
```

---

## 4. Super Admins ("The Escape Hatch")

Certain edge-case Users intrinsically require 100% overriding application control circumventing rigid permission matrices entirely: **Super Admins**.

The `User.is_admin` flag forcefully overrides all `requirePermission()` bounds structurally in both Node.js API middlewares and React logic ensuring complete lockout prevention during server failure scenarios. Use this flag with extreme care natively.
