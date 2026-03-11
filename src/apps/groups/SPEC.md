# Core Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand WHAT features to build inside `src/apps/groups`. 
> Read `.cursorrules` and `README.md` to understand HOW to build them securely against the core architecture.

---

## Objective
[Describe the high-level business goal of the feature here. Example: "Add an endpoint allowing users to reset their two-factor authentication."]

## 1. Database Modifications (`api/models`)
*Define any core schema alterations needed for this module.*
- **Model:** [e.g., `User`]
- **New Columns:** [e.g., Add `two_factor_secret` as `DataTypes.STRING`.]
- **Relations:** [e.g., Make sure it creates a `hasMany` relationship with the `AuditLog` model.]

## 2. API Routes & Controllers (`api/`)
*Define the native expressive routes this module will support.*
- **Method & Path:** [e.g., `POST /api/users/2fa/reset`]
- **Expected Payload:** [e.g., `{ userId: z.string().uuid() }`]
- **Security Check:** [e.g., Wrap route in `requireAuth` and `requirePermission('users:manage')`.]
- **Controller Logic:** [Describe what the service layer should output to the client.]

## 3. Frontend SSR Rendering (`views/`)
*Define the React views and data fetching lifecycle.*
- **Component Details:** [e.g., "Create `TwoFactorSettings.js`".]
- **Route Injection:** [e.g., "Add `_route.js` which exports the middleware and the mount function".]
- **SSR Hook:** [e.g., "Inside `getInitialProps`, dispatch a fetch to `/api/users/2fa/status` to pre-load the 2FA status before the page renders."]
- **State Management:** [e.g., "Add the Thunks and `createSlice` to `views/(admin)/users/redux/`".]

## 4. Localization (`translations/` or shared i18n)
*Define required user-facing terminology.*
- **Keys Required:** [e.g., `users.2fa.reset_success`, `users.2fa.btn_reset`]
- **Rule:** Do not hardcode these strings. Pre-load them into the dashboard and wrap output in `i18n.t()`.

---
*Note: Once this file is filled out, ask the AI to **"Execute SPEC.md"**.*
