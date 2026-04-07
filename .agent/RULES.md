# Universal AI Agent Rules

This document dictates exactly how any AI Agent (Cursor, Claude, Gemini, Antigravity) must behave when processing the `xnapify` codebase. It governs response formatting, coding constraints, and architectural boundaries.

Whenever you provide assistance to a Developer on this codebase, you MUST adhere to the following rules:

---

## 1. Response Rules
- **No Conversational Filler**: Be concise. Provide exactly the code requested. Do not say "I can help with that." or "Here is the code." Just output the code.
- **Absolute Paths**: When referencing files or generating new files, provide the exact path from the root of the repository (e.g., `src/apps/billing/api/index.js`).
- **Explain Only When Asked**: If a developer asks for a refactor, provide the refactored code block. Do not write a multi-paragraph explanation of *why* you refactored it unless they explicitly ask for an explanation.

---

## 2. Hard Coding Boundaries
- **Use the Single Source of Truth**: The `AGENT.md` file defines the overarching architecture (React 18 SSR, Express 4, Sequelize, Redux Toolkit). **Never deviate** from these technologies. If a developer asks you to "install Tailwind," ask for explicit override permission first, because `AGENT.md` strictly enforces CSS Modules.
- **Stop at Domain Boundaries**: Never write deeply coupled code between two isolated applications (`@apps/billing` should not `import` from `@apps/invoices`). Always utilize the DI container, hook system, or standard HTTP APIs for cross-domain communication.
- **No Raw SQL**: Unless debugging a confirmed performance bottleneck, strictly utilize Sequelize ORM methods (`findAll`, `create`). Access models via `container.resolve('db').models` or `container.resolve('models')`.

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
- **Environment Variables**: New environment configurations must always use the `XNAPIFY_` prefix.

---

## 4. Frontend Rigidity
- **React Components**: Strictly Functional Components with hooks. Refuse any request to build a Class component.
- **i18n Requirement**: All user-facing strings in JSX must be wrapped in `i18n.t()`. No hardcoded strings are allowed in any UI file.
- **Data Hooking**: You must honor the SSR lifecycle. Use `getInitialProps` on routing files (`_route.js`) for initial server rendering. Do not fetch essential initial data on `useEffect` mounts.
- **CSS Modules**: Use `.module.css` extension for component-scoped styles. Do not use inline styles or global CSS for component styling.

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
  `translations → providers → boot → routes`
- **Declarative hooks** (`migrations`, `models`, `seeds`, `routes`) return Webpack `require.context` directly — the autoloader handles execution.
- **Imperative hooks** (`providers`, `boot`) contain your initialization logic and receive `{ container }`.
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

## Instructing the AI

If you are a Developer reading this, you can append these rules to your AI prompts natively using the context commands depending on your IDE (e.g. `@RULES.md` in Cursor, adding this file to Claude Projects).

*If utilizing the unified .agent system defined in `AGENT.md`, these conventions are automatically absorbed!*
