# Core Module AI Instructions

This folder (`src/apps/users/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.

1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.

---

# Users Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the core identity and administrative management logic inside `src/apps/users`.
> This module is the source of truth for all system users, their profiles, and their security identifiers.

---

## Objective

Provide a centralized system for managing user identities, profiles, administrative roles, and secure programmatic access via API keys.

## 1. Database Modifications (`api/models`)

- **Model:** `User`
  - **Properties:** `id` (UUID), `email` (Unique), `password_hash`, `status` (Active/Suspended/Pending).
- **Model:** `UserProfile`
  - **Properties:** `user_id`, `first_name`, `last_name`, `bio`, `website`.
- **Model:** `UserApiKey`
  - **Properties:** `id`, `user_id`, `name`, `key_hint`, `hashed_key`, `last_used_at`.
- **Relations:**
  - `User` hasMany `UserLogin` (audit trail of IPs and devices).
  - `User` belongsToMany `Role` and `Group`.

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `GET /api/users`
  - **Security:** Requires `users:read` permission.
  - **Logic:** Returns paginated list of users with their roles and group memberships.
- **Method & Path:** `POST /api/users`
  - **Security:** Requires `users:manage` permission.
  - **Logic:** Creates a new user account with initial role assignments.
- **Method & Path:** `GET /api/users/[id]`
  - **Logic:** Fetches full user context including profile, roles, and groups.
- **Method & Path:** `PATCH /api/users/[id]`
  - **Logic:** Administrative update of user status or specific profile fields.
- **Programmatic Access:**
  - `GET /api/users/[id]/api-keys`: List active keys for a user.
  - `POST /api/users/[id]/api-keys`: Generate a new API key (key is shown only once).
  - `DELETE /api/users/[id]/api-keys/[keyId]`: Revoke a specific key.
- **RBAC Assignments:**
  - `POST /api/users/[id]/roles`: Update user roles.
  - `POST /api/users/[id]/groups`: Update user group memberships.

## 3. Frontend SSR Rendering (`views/`)

- **Admin View:** `/admin/users`
  - **Component:** `Users.js`.
  - **Logic:** Master list of system users with mass actions (Change status, Delete).
- **Admin View:** `/admin/users/create`
  - **Component:** `CreateUser.js`.
- **Admin View:** `/admin/users/[userId]/edit`
  - **Component:** `EditUser.js`.
- **User Settings:** `/admin/users/[userId]/api-keys`
  - **Component:** `UserApiKeys.js`.
  - **Logic:** UI for users or admins to manage programmatic access tokens.

## 4. Localization (`translations/`)

- **Keys:** `users.title.manage`, `users.status.suspended`, `users.api_keys.warning_save_secret`.
- **Rule:** Use `i18n.t('users.status.' + status)` to render human-readable user states.

---

_Note: This spec reflects the CURRENT implementation of the user management system._
