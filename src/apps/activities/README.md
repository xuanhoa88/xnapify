# Activities Module

The **Activities** module is a core system component responsible for recording, storing, and displaying an audit trail of actions performed within the application. It acts as a central logging facility to track user interactions, entity modifications, and system events.

## Key Features

- **Asynchronous Logging (Performance):** Activity logging uses direct function calls to `LOG_ACTIVITY` (via `activities.worker.js`). This ensures that logging operations (which include database writes) are cleanly separated from the main API request lifecycle.
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
│   │   └── activities.worker.js  # Worker function (LOG_ACTIVITY)
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
5. **Same-Process Execution:** The `LOG_ACTIVITY` function in `activities.worker.js` receives the payload and executes `Activity.create(...)` in the database.

## Modifying This Module

When adding new logging events:
1. Ensure the source module emits an event through the central Hook channel.
2. Add a listener to `src/apps/activities/api/hooks.js` to catch the new event and dispatch it via `logActivity()`.
3. Update the `eventOptions` filter inside `src/apps/activities/views/(admin)/(default)/ActivityList.js` to allow admins to filter by the new event type in the UI.
