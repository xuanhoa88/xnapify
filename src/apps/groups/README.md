# Core Module AI Instructions

This folder (`src/apps/groups/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.

1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.

---

# Groups Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the group management logic inside `src/apps/groups`.
> Groups are used to organize users into logical units (e.g., Engineering, Marketing) and assign collective roles.

---

## Objective

Provide a system for organizing users into groups, allowing for hierarchical roles and consolidated permission management.

## 1. Database Modifications (`api/models`)

- **Model:** `Group`
  - **Properties:** `id` (UUID), `name` (Unique), `description`.
- **Model:** `GroupRole`
  - **Properties:** Junction table linking `Group` to `Role`.

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `GET /api/groups`
  - **Security:** Requires `groups:read` permission.
  - **Logic:** Returns list of all groups with user counts and role summaries.
- **Method & Path:** `POST /api/groups`
  - **Security:** Requires `groups:manage` permission.
  - **Logic:** Creates a new group.
- **Method & Path:** `GET /api/groups/[id]`
  - **Logic:** Fetches group details including members and assigned roles.
- **Method & Path:** `PATCH /api/groups/[id]`
  - **Logic:** Updates group metadata.
- **Membership & Roles:**
  - `GET /api/groups/[id]/users`: List users in this group.
  - `GET /api/groups/[id]/roles`: List roles assigned to this group.
  - `POST /api/groups/[id]/roles/[role_id]`: Assign a role to the group.
  - `DELETE /api/groups/[id]/roles/[role_id]`: Remove a role from the group.

## 3. Frontend SSR Rendering (`views/`)

- **Admin View:** `/admin/groups`
  - **Component:** `GroupList.js` or `Groups.js`.
- **Admin View:** `/admin/groups/[id]`
  - **Component:** `GroupDetail.js`.
  - **Logic:** Manage group members, roles, and view effective permissions.

## 4. Localization (`translations/`)

- **Keys:** `groups.list.no_members`, `groups.actions.add_user`, `groups.validation.duplicate_name`.

---

_Note: This spec reflects the CURRENT implementation of the group management system._
