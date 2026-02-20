# API Dynamic Router

A file-based dynamic routing engine for Express, modeled after Next.js and the React `react-router` structure. It provides automatic path resolution, nested middlewares, and dynamic parameter extraction simply by creating folders and files.

## Philosophy

The API router maps the file system directory structure directly into URL endpoints, allowing you to intuitively organize backend code. It heavily mirrors the `src/shared/renderer/router` so developers can use the same mental model for both frontend React pages and backend Express APIs.

### Architecture

| Component      | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `collector.js` | Scans file paths for `_route.js`, `_middleware.js`, and configs  |
| `builder.js`   | Constructs a structured route tree from collected modules        |
| `radix.js`     | Radix tree (compressed trie) for O(log n) URL matching           |
| `matcher.js`   | Caches the radix tree and exposes `findRoute()`                  |
| `lifecycle.js` | Composes middleware chains and executes route handlers           |
| `composer.js`  | Koa-style middleware composition for correct async/sync handling |
| `index.js`     | `Router` class — the public API                                  |
| `utils.js`     | Logging, error normalization (`RouterError`), path utilities     |

## How to Use

### 1. Creating API Endpoints (`_route.js`)

In your module's `api/routes` folder, create `.js` files named `_route.js`. The directory name dictates the path. Inside these files, export the HTTP methods you want to handle.

**Standard Module Mapping:**

- `src/modules/users/api/routes/_route.js` -> `/users`

**Priority Handling & `(default)` wrapping:**
If you place `_route.js` inside a `(default)` folder, it takes priority over a file at the same tier. This allows clean file organization at the root of a module.

- `src/modules/users/api/routes/(default)/_route.js` -> `/users` (Overrides the standard mapping above)

**The `(default)` Module:**
If the module itself is named `(default)`, its namespace is dropped from the path.

- `src/modules/(default)/api/routes/(default)/_route.js` -> `/`
- `src/modules/(default)/api/routes/login/_route.js` -> `/login`

```javascript
export function get(req, res) {
  // Handles the GET request for the mapped path
  res.json({ message: 'Success' });
}
```

### 2. Module Scoping & Section Roots

If a module provides API routes for a specific section root (like `admin` or `customer`), simply create that folder inside the `api/routes/` directory. The router automatically appends the module name to the folder name to prevent path clashing.

**Example: `src/modules/users/api/routes/admin/_route.js` -> `/admin/users`**

```javascript
export function get(req, res) {
  // Handles GET /admin/users
  res.json({ message: 'List of admin users' });
}
```

_(Note: To map explicitly to the global `/admin` path instead of `/admin/users`, the module would need to be the explicit `(default)` module: `src/modules/(default)/api/routes/admin/_route.js`.)_

### 3. Handling Dynamic Parameters (`[param]`)

Use brackets in folder names for dynamic Express parameters.

**Example: `src/modules/users/api/routes/users/[id]/_route.js` -> `/users/:id`**

```javascript
export function get(req, res) {
  // Access dynamic parameters automatically bound to req.params
  const userId = req.params.id;
  res.json({ message: `Fetching user ${userId}` });
}
```

### 4. Using Route-level Middlewares (`_middleware.js`)

If you need authentication or specific checking for a group of routes, create a `_middleware.js` file in that directory. It will apply to the directory and all children hierarchically.

**Example: `src/modules/users/api/routes/users/_middleware.js` (Applies to `/users` and `/users/*`)**

You can export a single function, or an array of standard Express middlewares if you need multiple steps:

```javascript
import { rateLimiter } from 'rapid-rsk/middlewares';

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Exporting an array chains them sequentially
export default [rateLimiter, requireAuth];
```

#### Opting-Out / Overriding Parent Middlewares

By default, the router inherits all parent `_middleware.js` files down to the route level.
If a specific child endpoint needs to completely **bypass** the parent's rules (e.g., creating a public login route under a protected `users` directory), you can export `middleware` directly in the `_route.js` file.

- **`export const middleware = false;`** -> Drops all parent middlewares entirely (route becomes completely public/unfiltered).
- **`export const middleware = [myCustomMiddleware];`** -> Drops all parent middlewares AND runs ONLY the array or function provided.

**Example: `_route.js` explicitly substituting parent middlewares**

```javascript
export const middleware = [
  function rateLimitOrCustomCheck(req, res, next) {
    // Only this middleware runs! Parent _middleware.js is skipped entirely.
    next();
  },
];

export function get(req, res) {
  // Executes normally after substitution array!
}
```

#### Method-Specific Middlewares

If you want to apply specific middlewares to _only_ a `GET` request or a `POST` request rather than the entire `_route.js` file, you can export an array for the HTTP method. Following Express architecture, the array should contain your middlewares sequentially, with the final route handler as the last element. This will run **in addition** to any inherited or generic middlewares.

**Example: Protecting a POST endpoint but keeping GET public:**

```javascript
import { requireAuth } from 'rapid-rsk/middlewares';

// Drop all inherited parent middlewares (making the route inherently public)
export const middleware = false;

// Keep GET public by exporting just the single handler function
export function get(req, res) {
  res.json({ public: true });
}

// Enforce authentication strictly on the POST handler by exporting an array
export const post = [
  requireAuth,
  function post(req, res) {
    // Will only reach here if requireAuth passes!
    res.json({ protected: true });
  },
];
```

### 5. Error Handling

Route handler errors are automatically normalized into a consistent `RouterError` shape with `status`, `message`, `code`, and `details` properties, then passed to Express error middleware via `next(err)`.

```javascript
import { createError } from 'rapid-rsk/shared/api/router/utils';

export function get(req, res) {
  // Throw a structured error — automatically normalized
  throw createError('Resource not found', 404, { code: 'NOT_FOUND' });
}
```

Define a global Express error handler to format these consistently:

```javascript
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message,
    code: err.code,
  });
});
```

### 6. Registering with Express

Depending on your loader, you instantiate the router and link it via Express's `app.use()`.

```javascript
import Router from './router';

// In autoloader's discoverModules setup:
const apiAdapter = createContextAdapter(modulesContext);
const apiRouter = new Router(apiAdapter);

app.use('/api', apiRouter.resolve);
```

### 7. Dynamic Plugins (Add / Remove Base Routes)

If your app supports loading external plugin modules on the fly, you can dynamically attach or detach them.

```javascript
import { createContextAdapter } from 'rapid-rsk/shared/context';

const pluginAdapter = createContextAdapter(
  require.context('/path/to/plugin/api/routes'),
);

// Attach the plugin's routes dynamically
app.get('apiRouter').add(pluginAdapter);

// Unload when disabling plugin
app.get('apiRouter').remove(pluginAdapter);
```
