# Core Module AI Instructions

This folder (`src/apps/roles/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.

1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.

---

# Roles Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the role-based access control management inside `src/apps/roles`.
> Roles serve as containers for multiple permissions and can be assigned to users or groups.

---

## Objective

Provide a flexible RBAC infrastructure that allows administrators to define roles and map them to granular system permissions.

## 1. Database Modifications (`api/models`)

- **Model:** `Role`
  - **Properties:** `id` (UUID), `name` (Unique, e.g., `admin`, `editor`), `description`.
- **Model:** `RolePermission`
  - **Properties:** Junction table linking `Role` to `Permission`.

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `GET /api/roles`
  - **Security:** Requires `roles:read` permission.
  - **Logic:** Returns all system roles with permission counts.
- **Method & Path:** `POST /api/roles`
  - **Security:** Requires `roles:manage` permission.
  - **Logic:** Creates a new role.
- **Method & Path:** `GET /api/roles/[id]`
  - **Logic:** Fetches role details including all associated permissions.
- **Method & Path:** `POST /api/roles/[id]/permissions`
  - **Logic:** Bulk assigns or synchronizes permissions for a role.
- **Method & Path:** `GET /api/roles/[id]/groups`
  - **Logic:** Lists groups that have this role assigned.
- **Method & Path:** `POST /api/roles/rbac/initialize`
  - **Security:** Requires `admin` superuser.
  - **Logic:** System bootstrap route that ensures core roles (Admin, Member) and permissions are correctly seeded in the database.

## 3. Frontend SSR Rendering (`views/`)

- **Admin View:** `/admin/roles`
  - **Component:** `RoleList.js` or `Roles.js`.
- **Admin View:** `/admin/roles/[id]`
  - **Component:** `RoleDetail.js`.
  - **Logic:** Interface for editing role metadata and a checkbox grid or transfer list for managing `Permission` assignments.

## 4. Localization (`translations/`)

- **Keys:** `roles.types.admin.name`, `roles.types.user.name`, `roles.actions.assign_permissions`.
- **Note:** Roles like `admin` should have their display names localized in the UI while keeping the database `name` steady for code-level permission checks.

---

_Note: This spec reflects the CURRENT implementation of the role management system._
