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

1. **`init(ctx)`** - Ran once per navigation, parent route → child route, before the route's data loads. Use it for setup that the render depends on, such as `store.injectReducer()`.
2. **`mount(ctx)`** - Ran on every navigation INTO this route
3. **`unmount(ctx)`** - Ran on navigation AWAY from this route

> **`init` is remembered on the context, not on the route node.** On the server one compiled route tree is shared by every request (see §7) while each request builds its own store, so a node-level "already initialized" flag would inject a route's reducer into the _first_ request's store and leave every later request without it. The same applies to a route's `translations()`. Both are therefore memoized in `ctx`, which means `init` runs once per navigation — keep it idempotent (`injectReducer` already is).

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

## 6. Dynamic Extension Registration

The Router supports adding and removing routes dynamically at runtime without restarting the application!

```javascript
import { createRspackContextAdapter } from '@shared/utils/contextAdapter';

const extensionAdapter = createRspackContextAdapter(
  import.meta.webpackContext('/path/to/my-module/views'),
);

// Add dynamic routes seamlessly into the existing active app tree
router.add(extensionAdapter);

// Unmount and flush those specific routes on demand
router.remove(extensionAdapter);
```

## 7. Lazy Views, Materialization and the Compiled Tree

Application views are collected from a `mode: 'lazy'` require context, so each
view is its own chunk and the page that boots the router does not bundle every
route of every module.

**Collection is deferred.** `collect(adapter, type, { defer: true })` — set
automatically when the adapter reports `lazy: true` — emits a `load()` thunk
per entry instead of a module. Every key the collector produces (pathname,
module name, layout name) comes from the _file path_, so the whole tree can be
built without evaluating a single view.

**A deferred node is incomplete.** Until it is materialized it carries only
`path`, `moduleName`, `filePath` and `materialize()`; `action`, `module`,
`init`, `mount`, `unmount`, `translations` and `assetPaths` are all undefined.
Never read those off a node you have not materialized.

```javascript
import { materializeRoute, materializeTree } from './builder.js';

// One matched route and its ancestors (what resolve() does for you)
const freshlyLoaded = await materializeRoute(route);

// Or the whole tree — the server does this at boot
await materializeTree(router.routes);
```

`resolve()` materializes the matched route before any hook reads its module,
and runs the `setup` hook of every node that call just loaded, so a
registration written for that render is not missed.

**The server compiles once and shares.** `compileServerViews()` in
`src/bootstrap/views.js` builds the tree, injects extension routes, appends the
catch-all and materializes everything, then hands the result to each request:

```javascript
new AppRouter(mergedAdapter, {
  ...routerOptions,
  compiled: { routes, layouts },
});
```

With `compiled`, the constructor skips collection and tree building entirely.
Each request still gets its own Router (navigation queue, registration state)
over the same nodes — which is exactly why per-request state must never be
cached on a node. There is no `Router.compile()`; `compiled` is simply the
`routes` and `_layouts` of a Router that has already been built.

**Telling the server which chunks to send.** After a resolve, the router
exposes what that navigation touched:

- `router.viewAssets` — source files of the matched route, its ancestors and
  their layouts and configs. The server maps them to chunk filenames and emits
  them with the entry bundle, so a lazily chunked view costs no extra round
  trip. Empty for an eagerly collected tree.
- `router.viewNamespaces` — extension namespaces the resolve activated, in
  match order, so the server can ship the assets of the deferred extensions
  whose slots it just rendered.

Both are reset by the outermost resolve only: a resolve that nests (the
catch-all re-entering with `/not-found`, `errorHandler` with `/error`) adds to
them rather than replacing them.
