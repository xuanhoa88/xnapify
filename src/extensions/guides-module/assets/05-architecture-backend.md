---
id: architecture-backend
title: Backend Engines
sidebar_position: 5
---

# Backend Engines

The **xnapify** backend eliminates duplicate infrastructure logic across domains by centralizing core functionalities under the `shared/api/engines/` layer. These engines behave as system-level singletons that execute foundational duties like WebSockets, scheduling, file systems, and databases. 

Applications resolve these engines using the `container` Dependency Injection context passed to their `boot` or `providers` lifecycle hooks.

---

## 1. Database (`db` & `models`)

The database engine dynamically detects your target Relational database dialect (SQLite, PostgreSQL, MySQL) at runtime by evaluating preboot arguments (`XNAPIFY_DB_URL`). It manages Sequelize orchestration and creates a centralized `ModelRegistry` encompassing schemas from all domains and extensions seamlessly.

### API Reference

| Service Key | Return Type | Purpose |
| --- | --- | --- |
| `'db'` | `Sequelize Connection Manager` | Offers database connection strings, transaction wrapping, and direct execution (`db.connection.query()`). |
| `'models'` | `Object` | Provides deterministic access to all active tables registered via auto-discovery (e.g. `const models = container.resolve('models'); await models.Users.findAll()`). |

> [!NOTE]
> Migrations and Seeds are executed natively by the Engine during deployment startup phases; there is no need for external Node CLI run operations.

---

## 2. Worker Engine (`worker`)

Modules can encapsulate intensive computational scripts or long-running logic as *Workers*. Workers are direct function calls that run within the main Node.js process but are typically dispatched via the job queue for asynchronous execution, keeping the HTTP request loop responsive.

```javascript
/* src/apps/my_app/api/index.js */
async boot({ container }) {
    // Standard execution of an abstracted node thread payload.
    const { startDataIndexJob } = require('./workers')
    await startDataIndexJob(container.resolve('models'))
}
```

---

## 3. Web Sockets (`ws`)

The WebSocket engine maintains active live connections scoped securely by Authentication tokens. It coordinates broadcast emissions mapped to isolated URL channels.

### API Reference

| Service Key | Return Type | Method | Purpose |
| --- | --- | ---| --- |
| `'ws'` | `WebSocketManager` | `sendToPublicChannel(event, data)` | Broadcasts data to all connected clients on the public channel (e.g., `ws.sendToPublicChannel('extension:updated', { type: 'EXTENSION_INSTALLED' })`). |

---

## 4. Scheduling (`schedule`)

Wraps `node-cron` definitions safely avoiding overlap collisions.

### API Reference

```javascript
const schedule = container.resolve('schedule');

// Standard API syntax:
schedule.register(
    'daily_garbage_collection',  // Unique Id
    '0 3 * * *',                 // Standard Cron Timing Variable (e.g. 3 AM)
    async () => {
         // Payload Logic
         await ExecuteTask()
    },
    { timezone: 'UTC'}
)
```

---

## 5. Message Queue (`queue`) & Hooks (`hook`)

These engines handle cross-domain communication structurally avoiding hard-linking dependency imports out of isolated apps folders. 

- **Hook:** Uses direct Pub/Sub patterns for synchronous execution. For example, when `src/apps/users` fires `hook('users').emit('created')`, independent extensions in `src/extensions` listening to `hook('users').on('created')` fire off sequentially.
- **Queue:** Standard job queue systems executing background payload retries and batching behavior asynchronously.

### Email Hook Example

```javascript
// A ubiquitous cross-module event call executed safely without static imports
const hook = container.resolve('hook');

await hook('emails').emit('send', {
  slug: 'welcome_template',     
  to: 'hello@xnapify.com', 
  html: '<p>Standard HTML Fallback if missing slug.</p>', 
  data: { user_id: 42 } 
});
```

---

## 6. Miscellaneous Utilities

Additional engines expose fundamental utilities safely ensuring isolation mapping isn't breached:

- **`cache`**: Memory LRU caching scoped utilizing namespaces. (e.g., `const scopedCache = cache.withNamespace('users'); scopedCache.set('list', [])`).
- **`fs`**: Safe-guarded File System reads preventing traversal attacks outside the application scope folders.
- **`http`**: Standardized Response formatters (e.g., `http.sendSuccess(res, data)` or `http.sendError(res, message, statusCode)`).
- **`template`**: Executes raw `<p> {{ text }} </p>` template operations utilizing LiquidJS rendering (mostly used alongside the Email engine's templating system).
