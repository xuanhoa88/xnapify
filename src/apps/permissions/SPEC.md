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
*Note: This spec reflects the CURRENT implementation of the permission registry.*
