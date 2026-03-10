# Renderer Dynamic Router

A powerful file-based dynamic routing engine for the React frontend, designed with extensive support for dynamic module loading, nested layouts, route configs, and server/client lifecycle hooks.

By mapping the file system to UI routes, developers can easily organize their views within modular boundary contexts without manually maintaining giant routing configuration files.

## High-Level Philosophy

The React Renderer router scans all `[module]/views/` directories automatically. It extracts the file structures to build an interactive, pre-calculated route tree for the application.

## 1. Creating Routes (`_route.js`)

To define a page in your React app, place a `_route.js` (or `.tsx`) file in your module's `views/` directory. The path to the folder determines its URL.

**Standard Module Mapping:**

- `@apps/users/views/_route.js` -> `/users`

**Priority Handling & `(default)` wrapping:**
To create paths at the root of a module without explicitly placing it at the filesystem root, use `(default)`.

- `@apps/users/views/(default)/_route.js` -> `/users` (Overrides standard mapping)

**The `(default)` Module:**
If the module itself is named `(default)`, its namespace is dropped from the path.

- `@apps/(default)/views/(default)/_route.js` -> `/`
- `@apps/(default)/views/dashboard/_route.js` -> `/dashboard`

### Route Module Exports

A frontend `_route.js` file should export a React Component (or a route object). It can also export layout components or lifecycle hooks.

```javascript
import React from 'react';

export default function UsersPage() {
  return <div>Welcome to Users Page</div>;
}

// Optional: Provide custom data or async actions before the route renders
export const action = async ctx => {
  return { data: await fetchUsers() };
};
```

## 2. Dynamic Route Parameters

Use brackets in folder names for dynamic URL parameters matching paths like `/users/:id`.

- `@apps/users/views/users/[id]/_route.js` maps to `/users/:id`
- `@apps/users/views/[...slug]/_route.js` maps to a catch-all route (e.g., `/users/*`)

These parameters become available in the router context object at runtime during data fetching and resolving!

## 3. Layouts (`_layout.js`)

The router natively supports persistent UI wrappers via `_layout.js`.

### Colocated Layouts

If you want a wrapper around a specific set of routes:

- `@apps/users/views/users/_layout.js` -> Wraps `/users` and `/users/*` (like Next.js)

### Global / Theme Layouts

Layouts placed inside a `(layouts)` group are injected into the global view routing tree!

- `@apps/(default)/(layouts)/main/_layout.js`

## 4. Configuration Components (`(routes)`)

You can inject specific routing options or global configs directly into the route tree by placing configuration scripts inside a `(routes)` group folder implicitly within a module:

- `@apps/(default)/(routes)/(main).js`

This allows modifying how specific paths operate natively!

## 5. Lifecycle Management

The Router supports three primary internal state lifecycles:

1. **`init(ctx)`** - Ran once when the application starts / route is first matched
2. **`mount(ctx)`** - Ran on every navigation INTO this route
3. **`unmount(ctx)`** - Ran on navigation AWAY from this route

You can export these functions cleanly from `_route.js` files to seamlessly handle component setup and teardown automatically.

```javascript
export async function mount(ctx) {
  console.log('Entering Dashboard!');
}

export async function unmount(ctx) {
  console.log('Leaving Dashboard!');
}

export default function Dashboard() {
  return <div>Dashboard Loaded</div>;
}
```

## 6. Dynamic Plugin Registration

The Router supports adding and removing routes dynamically at runtime without restarting the application!

```javascript
import { createWebpackContextAdapter } from '@shared/utils/webpackContextAdapter';

const pluginAdapter = createWebpackContextAdapter(
  require.context('/path/to/my-module/views'),
);

// Add dynamic routes seamlessly into the existing active app tree
router.add(pluginAdapter);

// Unmount and flush those specific routes on demand
router.remove(pluginAdapter);
```
