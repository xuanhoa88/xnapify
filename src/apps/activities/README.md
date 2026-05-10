# Activities Module

The **Activities** module is a core system component responsible for recording, storing, and displaying an audit trail of actions performed within the application. It acts as a central logging facility to track user interactions, entity modifications, and system events.

## Key Features

- **Asynchronous Logging (Performance):** Activity logging uses direct function calls to `logActivity` (default export from `activities.worker.js`). This ensures that logging operations (which include database writes) are cleanly separated from the main API request lifecycle.
- **Event-Driven Architecture:** The module uses the central `HookEngine` (`api/hooks.js`) to listen for events emitted by other modules (e.g., `auth:logged_in`, `admin:users:created`). Services in other modules do not need to depend on the `activities` module directly; they simply emit events.
- **Comprehensive Audit Trail:** Captures "who did what to whom/what", including the `actor_id` (who performed the action), `event` (the action taken), `entity_type` (what was affected, e.g., 'user', 'role'), and `entity_id` (the specific item).
- **Admin Dashboard UI:** Provides a dedicated view (`/admin/activities`) for administrators to view, filter (by event and entity type), and paginate through the system's activity logs.

## Module Structure

```
src/apps/activities/
├── api/
│   ├── index.js                  # Module registration (hooks, static routes)
│   ├── hooks.js                  # Event listeners that trigger logging
│   ├── models/
│   │   └── Activity.js           # Sequelize model defining the activity table schema
│   ├── workers/                  # Worker function utilities
│   │   ├── index.js              # Utility wrapper exporting logActivity()
│   │   └── activities.worker.js  # Worker function (default export)
│   ├── controllers/
│   │   └── admin/
│   │       └── activities.controller.js # API Controller for fetching logs
│   ├── database/
│   │   ├── migrations/           # Database schema migrations
│   │   └── seeds/                # Initial RBI permissions for activities
│   └── routes/
│       └── (admin)/
│           └── (default)/
│               └── _route.js     # API Route definitions (GET /api/admin/activities)
├── views/
│   ├── index.js                  # Module view registration and Redux injection
│   ├── (admin)/
│   │   ├── (default)/
│   │   │   ├── ActivityList.css  # Styles for the UI
│   │   │   ├── ActivityList.js   # React component for the logs table
│   │   │   └── _route.js         # Frontend route definition (/admin/activities)
│   │   └── redux/                # State management for fetching and storing UI logs
│   │       ├── index.js
│   │       ├── selector.js
│   │       ├── slice.js
│   │       └── thunks.js
└── package.json                  # Module metadata
```

## How It Works

1. **A user performs an action:** For example, updating a User profile.
2. **Controller emits event:** The User service emits a hook event: `hook('admin:users').emit('updated', { user, actorId })`.
3. **Activities Hook Listener:** The listener in `src/apps/activities/api/hooks.js` catches the `'updated'` event on the `'admin:users'` channel.
4. **Direct Function Call:** The hook listener formats the payload and calls `logActivity(container, { event, entity_type, entity_id, actor_id })`.
5. **Same-Process Execution:** The `logActivity` function in `activities.worker.js` receives the payload and executes `Activity.create(...)` in the database.

## Modifying This Module

When adding new logging events:

1. Ensure the source module emits an event through the central Hook channel.
2. Add a listener to `src/apps/activities/api/hooks.js` to catch the new event and dispatch it via `logActivity()`.
3. Update the `eventOptions` filter inside `src/apps/activities/views/(admin)/(default)/ActivityList.js` to allow admins to filter by the new event type in the UI.

---

# Activities Module Specification

> **Instructions for the AI:**
> Read this document to understand WHAT features are built inside `src/apps/activities`.
> Read `.agent/rules.md` and `AGENT.md` to understand HOW to build them securely against the core architecture.

---

## Objective

The Activities module serves as the central audit logging system. It asynchronously tracks user actions and system changes by listening to hook events emitted by other modules, and provides an admin interface to review these logs for security and auditing purposes.

## 1. Database Modifications (`api/models`)

_Defines the core schema supporting the module._

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

_Defines the native expressive routes this module supports._

- **Method & Path:** `GET /api/admin/activities`
- **Expected Payload:** Query parameters: `page`, `limit`, `event`, `entity_type`, `entity_id`, `actor_id`, `from_date`, `to_date`.
- **Security Check:** Route protected by standard auth middleware and requires the `activities:read` permission.
- **Controller Logic:** `activities.controller.js` queries the `Activity` model, applying pagination (limit/offset) and any optional `where` clause filters derived from the query parameters, ordered by `created_at DESC`.

## 3. Background Workers (`api/workers`)

_Defines background processing functions._

- **Implementation:** `activities.worker.js` exports `logActivity` (default export) which handles the actual database write (`Activity.create()`).
- **Execution:** `index.js` exports a `logActivity(container, payload)` utility that calls the worker function directly (same-process) for non-blocking I/O.

## 4. Frontend SSR Rendering (`views/`)

_Defines the React views and data fetching lifecycle._

- **Component Details:** `ActivityList.js` provides a table UI to display the logs, complete with dropdown filters for `event` and `entity_type`, and a pagination control.
- **Route Injection:** `_route.js` exports the middleware (RBAC `activities:read`) and mounts the route at `/admin/activities` under the `Monitoring` sidebar menu.
- **State Management:** `views/(admin)/redux/thunks.js` defines `fetchActivities` which hits the `GET /api/admin/activities` endpoint. The slice manages the `items`, `loading`, and `pagination` state.

## 5. Localization (`translations/` or shared i18n)

_Defines required user-facing terminology._

- **Keys Included:** `admin:navigation.activities`, `admin:activities.title`, `admin:activities.filter.allEvents`, `admin:navigation.monitoring`, etc.
- **Rule:** Used throughout `ActivityList.js` and `_route.js` via the `i18n.t()` function to support multi-language dashboard deployments.

---

_Note: This specification reflects the implementation within the xnapify framework._
