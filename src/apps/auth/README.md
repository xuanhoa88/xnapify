# Core Module AI Instructions

This folder (`src/apps/auth/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.

1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.

---

# Auth Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the authentication and identity management logic inside `src/apps/auth`.
> This module manages the lifecycle of user sessions, registration, and profile security.

---

## Objective

Provide secure, multi-tenant authentication support including JWT-based sessions, OAuth2 integration, and comprehensive user profile management.

## 1. Database Modifications (`api/models`)

_The Auth module consumes user-related models owned by the `users` module:_

- **Models:** `User`, `UserLogin`, `UserProfile`, `PasswordResetToken`.
- **Logic:** Manages password hashing (bcrypt), token expiration, and email-to-user links.

## 2. API Routes & Controllers (`api/`)

- **Method & Path:** `POST /api/auth/login`
  - **Logic:** Validates credentials, sets HTTP-only JWT cookies, and returns user data.
- **Method & Path:** `POST /api/auth/register`
  - **Logic:** Creates new user account, profile, and triggers email verification.
- **Method & Path:** `POST /api/auth/logout`
  - **Logic:** Clears authentication cookies and terminates session.
- **Method & Path:** `GET /api/auth/oauth/[provider]` & `/callback`
  - **Logic:** Handles Google/GitHub/etc. authentication flow.
- **Method & Path:** `POST /api/auth/refresh-token`
  - **Logic:** Rotates short-lived access tokens.
- **Profile Management:**
  - `GET /api/auth/profile`: Returns current authenticated user profile.
  - `PATCH /api/auth/profile/password`: Handles secure password updates.
  - `PATCH /api/auth/profile/preferences`: Updates user UI and locale settings.
  - `POST /api/auth/profile/avatar`: Processes user image uploads to storage.

## 3. Frontend SSR Rendering (`views/`)

_The Auth module does not contain its own view directory. Login and Register pages are handled by the system renderer or layout components using the shared client-side auth state._

## 4. Localization (`translations/`)

- **Keys:** `auth.login.failed`, `auth.password.reset_email_sent`, `auth.profile.update_success`.
- **Note:** All error messages returned by auth controllers must be localized.

---

_Note: This spec reflects the CURRENT implementation of the authentication system._
