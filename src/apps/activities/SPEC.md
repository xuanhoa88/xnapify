# Activities Module Specification

> **Instructions for the AI:** 
> Read this document to understand WHAT features are built inside `src/apps/activities`. 
> Read `.agent/rules.md` and `AGENT.md` to understand HOW to build them securely against the core architecture.

---

## Objective
The Activities module serves as the central audit logging system. It asynchronously tracks user actions and system changes by listening to hook events emitted by other modules, and provides an admin interface to review these logs for security and auditing purposes.

## 1. Database Modifications (`api/models`)
*Defines the core schema supporting the module.*
- **Model:** `Activity`
- **Columns:** 
  - `id` (INTEGER, Primary Key, Auto Increment)
  - `event` (STRING) - The action that occurred (e.g., `auth.logged_in`, `admin:users:created`)
  - `entity_type` (STRING, optional) - The type of record affected (e.g., `user`, `role`)
  - `entity_id` (STRING, optional) - The UUID/ID of the affected record
  - `actor_id` (STRING, optional) - The UUID of the user who performed the action
  - `metadata` (JSONB, optional) - Flexible JSON payload for storing additional context
  - `created_at` (DATE) - Timestamp of the action
- **Relations:** Designed to be largely independent to allow for high write throughput. `actor_id` implies a relationship to the User model but does not enforce a strict FK to prevent cascading deletes from destroying the audit trail.

## 2. API Routes & Controllers (`api/`)
*Defines the native expressive routes this module supports.*
- **Method & Path:** `GET /api/admin/activities`
- **Expected Payload:** Query parameters: `page`, `limit`, `event`, `entity_type`, `entity_id`, `actor_id`, `from_date`, `to_date`.
- **Security Check:** Route protected by standard auth middleware and requires the `activities:read` permission.
- **Controller Logic:** `activities.controller.js` queries the `Activity` model, applying pagination (limit/offset) and any optional `where` clause filters derived from the query parameters, ordered by `created_at DESC`.

## 3. Background Workers (`api/workers`)
*Defines off-main-thread processing.*
- **Implementation:** `activities.worker.js` handles the actual database write (`Activity.create()`). 
- **Pool Management:** `index.js` creates a dedicated `piscina` worker pool specifically for the Activities module to ensure non-blocking IO for the main HTTP process.

## 4. Frontend SSR Rendering (`views/`)
*Defines the React views and data fetching lifecycle.*
- **Component Details:** `ActivityList.js` provides a table UI to display the logs, complete with dropdown filters for `event` and `entity_type`, and a pagination control.
- **Route Injection:** `_route.js` exports the middleware (RBAC `activities:read`) and mounts the route at `/admin/activities` under the `Monitoring` sidebar menu.
- **State Management:** `views/(admin)/redux/thunks.js` defines `fetchActivities` which hits the `GET /api/admin/activities` endpoint. The slice manages the `items`, `loading`, and `pagination` state.

## 5. Localization (`translations/` or shared i18n)
*Defines required user-facing terminology.*
- **Keys Included:** `admin:navigation.activities`, `admin:activities.title`, `admin:activities.filter.allEvents`, `admin:navigation.monitoring`, etc.
- **Rule:** Used throughout `ActivityList.js` and `_route.js` via the `i18n.t()` function to support multi-language dashboard deployments.

---
*Note: This specification reflects the implementation within the xnapify framework.*
