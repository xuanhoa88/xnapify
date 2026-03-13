# Auth Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand the authentication and identity management logic inside `src/apps/auth`.
> This module manages the lifecycle of user sessions, registration, and profile security.

---

## Objective
Provide secure, multi-tenant authentication support including JWT-based sessions, OAuth2 integration, and comprehensive user profile management.

## 1. Database Modifications (`api/models`)
*The Auth module consumes user-related models owned by the `users` module:*
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
*The Auth module does not contain its own view directory. Login and Register pages are handled by the system renderer or layout components using the shared client-side auth state.*

## 4. Localization (`translations/`)
- **Keys:** `auth.login.failed`, `auth.password.reset_email_sent`, `auth.profile.update_success`.
- **Note:** All error messages returned by auth controllers must be localized.

---
*Note: This spec reflects the CURRENT implementation of the authentication system.*
