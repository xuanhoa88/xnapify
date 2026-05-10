# Core Module AI Instructions

This folder (`src/apps/permissions/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.

1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.

---

# Permissions Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the granular capability management inside `src/apps/permissions`.
> Permissions are the atomic units of authorization in the RBAC system, following the `resource:action` format.

---

## Objective

Provide a unified registry for defining and managing all granular permissions across the entire platform.

## 1. Database Modifications (`api/models`)

- **Model:** `Permission`
  - **Properties:**
    - `id`: UUID (Primary Key)
    - `resource`: String (e.g., `users`, `emails`, `files`)
    - `action`: String (e.g., `read`, `write`, `manage`)
    - `description`: String (Helpful context for administrators)
    - `status`: Enum (`active`, `disabled`)

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `GET /api/permissions`
  - **Security:** Requires `permissions:read` permission.
  - **Logic:** Returns all registered permissions. Supports filtering by `resource`.
- **Method & Path:** `POST /api/permissions`
  - **Security:** Requires `permissions:manage` permission.
  - **Logic:** Registers a new application permission.
- **Method & Path:** `GET /api/permissions/[id]`
  - **Logic:** Fetches permission metadata.
- **Method & Path:** `PATCH /api/permissions/[id]`
  - **Logic:** Updates description or status.
- **Method & Path:** `GET /api/permissions/resources/[resource]`
  - **Logic:** Helper route to list all actions available for a specific resource.

## 3. Frontend SSR Rendering (`views/`)

- **Admin View:** `/admin/permissions`
  - **Component:** `Permissions.js`.
  - **Logic:** Interactive table for managing the permission registry, with modals for creating new entries (`CreatePermissionModal.js`) or changing status.

## 4. Localization (`translations/`)

- **Keys:** `permissions.resources.users`, `permissions.actions.read`, `permissions.tooltips.manage`.
- **Rule:** Permission names should be rendered as `t('permissions.resources.' + resource) + ' > ' + t('permissions.actions.' + action)`.

---

_Note: This spec reflects the CURRENT implementation of the permission registry._
