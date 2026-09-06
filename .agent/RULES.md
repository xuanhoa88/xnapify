# Universal AI Agent Rules

This document dictates exactly how any AI Agent (Cursor, Claude, Gemini, Antigravity) must behave when processing the `xnapify` codebase. It governs response formatting, coding constraints, and architectural boundaries.

Whenever you provide assistance to a Developer on this codebase, you MUST adhere to the following rules:

---

## 1. Response Rules

- **No Conversational Filler**: Be concise. Provide exactly the code requested. Do not say "I can help with that." or "Here is the code." Just output the code.
- **Absolute Paths**: When referencing files or generating new files, provide the exact path from the root of the repository (e.g., `src/apps/billing/api/index.js`).
- **Explain Only When Asked**: If a developer asks for a refactor, provide the refactored code block. Do not write a multi-paragraph explanation of _why_ you refactored it unless they explicitly ask for an explanation.

---

## 2. Hard Coding Boundaries

- **Follow ECMAScript Standards**: The project targets Node 20+. Modern ES features like optional chaining (`?.`), nullish coalescing (`??`), and logical assignments (`??=`) are fully supported and encouraged for clean code.
- **Use the Single Source of Truth**: The `AGENT.md` file defines the overarching architecture (React 18 SSR, Express 4, Sequelize 6, Redux Toolkit). **Never deviate** from these technologies without explicit developer permission.
- **Stop at Domain Boundaries**: Never write deeply coupled code between two isolated applications (`@apps/billing` should not `import` from `@apps/invoices`). Always utilize the DI container, hook system, or standard HTTP APIs for cross-domain communication.
- **No Raw SQL**: Unless debugging a confirmed performance bottleneck, strictly utilize Sequelize ORM methods (`findAll`, `create`). Access models via `container.resolve('db').models` or `container.resolve('models')`.
- **Mandatory License Headers**: Every new source file you create MUST begin with the standard `xnapify` MIT License header.
  - For `.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.scss`, `.sass` files, use the `/** ... */` block comment style.
  - For `.yml`, `.sh`, and `Dockerfile` files, use the `#` comment style.
  - The exact text is:
    `xnapify (https://github.com/xuanhoa88/xnapify/)`
    `This source code is licensed under the MIT license found in the LICENSE.txt file in the root directory of this source tree.`

---

## 3. Security Constraints

- **Validation**: Every single `req.body`, `req.query`, or `req.params` entering an API controller MUST be validated using the custom Zod wrapper imported from `@shared/validator`. Never trust raw input.
- **Permissions**: Every new route must include an RBAC permission check. Resolve auth middlewares via the DI container:
  ```javascript
  function requirePermission(permission) {
    return (req, res, next) => {
      const auth = req.app.get('container').resolve('auth');
      return auth.middlewares.requirePermission(permission)(req, res, next);
    };
  }
  export const get = [requirePermission('resource:read'), handler];
  ```
  **Never** directly import from `@shared/api/engines/auth/middlewares` in route files — always resolve via `container.resolve('auth').middlewares`.
- **Environment Variables**: New environment configurations must always use the `XNAPIFY_` prefix. Every runtime variable must also be added to the zod schema in `shared/config/env.js` (so a bad value fails at boot with a readable message) and documented with a comment in `.env.xnapify`. Build-time-only variables are exempt from the schema.

---

## 4. Frontend Rigidity

- **React Components**: Strictly Functional Components with hooks. Refuse any request to build a Class component.
- **i18n Requirement**: All user-facing strings in JSX must be wrapped in `i18n.t()`. No hardcoded strings are allowed in any UI file.
- **Data Hooking**: You must honor the SSR lifecycle. Use `getInitialProps` on routing files (`_route.js`) for initial rendering. Do not fetch essential initial data on `useEffect` mounts.
- **Styling**: Primary styling must use **Tailwind CSS** utility classes and **Radix UI primitives** (`@radix-ui/themes`).
  - ✅ **DO** use Tailwind utility classes (e.g., `className="mt-4 bg-red-500"`).
  - ❌ **DO NOT** use inline styles under ANY circumstances (e.g., `style={{ marginTop: '16px' }}` is strictly forbidden).
  - ⚠️ All `.css` files are treated as **CSS Modules** by default (hashed class names). To define global styles (unhashed), you MUST name the file with the `.global.css` extension (e.g., `app.global.css`).
- **clsx Utility**: When applying custom CSS modules or combining conditional class names, ALWAYS use `clsx`. You must strictly follow these rules to prevent performance overhead during re-renders:
  - ✅ **DO** use for dynamic combinations: `className={clsx(s.base, condition ? s.active : s.inactive)}`
  - ✅ **DO** use multiple arguments for multiple conditions: `clsx(s.base, condA && s.a, condB && s.b)`
  - ❌ **DO NOT** use template literals or raw concatenation: ``className={`${s.base} ${s.active}`}`` -> use `clsx(s.base, s.active)`
  - ❌ **DO NOT** pass objects: `clsx({ [s.a]: condA, [s.b]: condB })` -> use `clsx(condA && s.a, condB && s.b)`
  - ❌ **DO NOT** use for single variables: `clsx(s.foo)` -> just use `className={s.foo}`
  - ❌ **DO NOT** use for simple ternaries: `clsx(cond ? s.a : s.b)` -> use `className={cond ? s.a : s.b}`
  - ❌ **DO NOT** use for static strings: `clsx('a', 'b')` -> just use `className="a b"`

---

## 5. Cross-Module Communication

- **No direct imports** between `@apps/*` modules. If `@apps/billing` needs data from `@apps/users`, use one of:
  - **Hook Engine (Pub/Sub)**: `hook('users').emit('created', data)` for asynchronous multicasting (errors don't halt execution)
  - **Hook Engine (Middleware)**: `hook('users').invoke('pre-delete', data)` for fail-fast pipeline checking (errors halt execution)
  - **DI Container**: `container.resolve('users:services')` for service access
  - **Email Service**: `container.resolve('emails:send')` or `hook('emails').emit('send', {...})` to send templated emails from any module or extension
  - **Extension Slots/Hooks**: `registry.registerHook('user.validate', fn)` for extensibility
  - **HTTP API**: `fetch('/api/users')` for loose coupling
- If none of these fit, the feature likely belongs in `@shared/`.

---

## 6. Module Lifecycle Hooks

- **API modules** (`api/index.js`) must use `export default { ... }` with lifecycle hooks in this order:
  `translations → providers → migrations → models → seeds → boot → routes`
- **View modules** (`views/index.js`) must use `export default { ... }` with:
  `translations → providers → menus → boot → routes`
- **`menus({ store, i18n })`** (view side only) is the one correct place to register sidebar navigation. Never register a menu from a route's `setup()`: a route's chunk is only fetched the first time that route is matched, so the link would be missing until the user is already on the page it points to.
- **`shutdown`** sits between `boot` and `routes` in both phase arrays but is never run by the autoloaders — application modules are never unloaded. It runs only when an **extension** is deactivated, and must exactly reverse what `boot`/`menus` registered.
- **Declarative hooks** (`translations`, `migrations`, `models`, `seeds`, and API `routes`) return a Rspack `import.meta.webpackContext` directly — the autoloader handles execution.
- **View `routes()`** is the exception: it must return `[context, { lazy: true }]` over a `mode: 'lazy'` context. Every view module has to agree — one module returning a bare context makes the merged adapter throw `MixedRouteLoadingStrategyError` at boot and the whole route tree fails to mount (`shared/renderer/autoloader.js`).
- **Imperative hooks** (`providers`, `menus`, `boot`) contain your initialization logic and receive `{ container }` (view side also gets `{ store, i18n }`).
- **Route hooks** (`_route.js`) may export: `middleware`, `init`, `setup`, `teardown`, `mount`, `unmount`, `getInitialProps`, `namespace`.

---

## 7. Test Co-Location

- **Place test files next to source**: `service.js` → `service.test.js` (same directory)
- **Use `__tests__/` only** for integration tests that span multiple files
- **Naming**: `*.test.js` for unit tests, `*.stress.test.js` for stress tests, `*.benchmark.js` for benchmarks

---

## 8. Hook Naming Convention

- **Format**: `{entity}.{action}` — e.g., `user.created`, `order.updated`, `file.deleted`
- **Channel names**: Use module name — e.g., `hook('users')`, `hook('billing')`
- **Full path**: Channel + event = `users → created`, `billing → invoice.paid`
- **Avoid**: Generic names like `data.changed` or `update`. Be specific.

---

## 9. API Stability

- **No breaking changes** to existing API response shapes without a migration path. Adding new fields to a response is safe; removing or renaming fields is a breaking change.
- **Versioning** (when needed): Use URL prefix `/api/v2/{resource}` alongside the original `/api/{resource}`. Both versions must coexist until consumers migrate.
- **Deprecation**: Mark deprecated endpoints with a response header `X-Deprecated: true` and a `deprecatedAt` field in the response body. Log usage for tracking.
- **Backward-compatible additions**: New optional query parameters, new response fields, and new endpoints are always safe to add without versioning.

---

## 10. Browser Verification Policy

- **Never auto-launch** a browser agent to verify UI changes unless the developer explicitly requests visual verification.
- When browser verification IS requested, the agent MUST follow the `browser-testing` skill — especially the **Port Discovery** section.
- The dev server port is `XNAPIFY_PORT` (default `1337`), **not** 3000. Always resolve from user context or `.env` files first.
- Before launching any browser automation, **verify the dev server is actually running** at the resolved port. If it is not running, inform the developer instead of failing silently.

---

## Instructing the AI

If you are a Developer reading this, you can append these rules to your AI prompts natively using the context commands depending on your IDE (e.g. `@RULES.md` in Cursor, adding this file to Claude Projects).

_If utilizing the unified .agent system defined in `AGENT.md`, these conventions are automatically absorbed!_
