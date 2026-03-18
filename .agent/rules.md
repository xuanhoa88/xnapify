# Universal AI Agent Rules

This document dictates exactly how any AI Agent (Cursor, Claude, Gemini, Antigravity) must behave when processing the `rapid-rsk` codebase. It governs response formatting, coding constraints, and architectural boundaries. 

Whenever you provide assistance to a Developer on this codebase, you MUST adhere to the following rules:

---

## 1. Response Rules
- **No Conversational Filler**: Be concise. Provide exactly the code requested. Do not say "I can help with that." or "Here is the code." Just output the code.
- **Absolute Paths**: When referencing files or generating new files, provide the exact, absolute path from the root of the repository (e.g. `src/apps/billing/api/index.js`).
- **Explain Only When Asked**: If a developer asks for a refactor, provide the refactored code block. Do not write a multi-paragraph explanation of *why* you refactored it unless they explicitly ask for an explanation. 

---

## 2. Hard Coding Boundaries
- **Use the Single Source of Truth**: The `AGENT.md` file defines the overarching architecture (React 18 SSR, Express 4, Sequelize, Redux Toolkit). **Never deviate** from these technologies. If a developer asks you to "install Tailwind," ask for explicit override permission first, because `AGENT.md` strictly enforces CSS Modules.
- **Stop at Domain Boundaries**: Never write deeply coupled code between two isolated applications (`@apps/billing` should not `import` from `@apps/invoices`). Always utilize the `@shared/plugin` system or standard HTTP internal APIs for cross-domain communication.
- **No Raw SQL**: Unless debugging a confirmed performance bottleneck, strictly utilize Sequelize ORM methods (`findAll`, `create`) and maintain the injection of `sequelize.models` correctly. 

---

## 3. Security Constraints
- **Validation**: Every single `req.body`, `req.query`, or `req.params` entering an API controller MUST be validated using the custom Zod wrapper imported from `@shared/validator`. Never trust raw input.
- **Permissions**: Every new route you generate must include an RBAC role or permission check via `requireAuth` and `requirePermission` middlewares from `@shared/api/auth/middlewares.js`.
- **Environment Variables**: New environment configurations must always use the `RSK_` prefix.

---

## 4. Frontend Rigidity
- **React Components**: Strictly Functional Components with hooks. Refuse any request to build a Class component.
- **i18n Requirement**: All user-facing strings in JSX must be wrapped in `i18n.t()`. No hardcoded strings are allowed in any UI file.
- **Data Hooking**: You must honor the SSR lifecycle. Use `getInitialProps` on routing files (`_route.js`) for initial server rendering. Do not fetch essential initial data on `useEffect` mounts.

---

## 5. Cross-Module Communication
- **No direct imports** between `@apps/*` modules. If `@apps/billing` needs data from `@apps/users`, use one of:
  - **Hook Engine**: `hook('users').on('created', handler)` for event-driven communication
  - **DI Container**: `container.resolve('users:services')` for service access
  - **Plugin Slots/Hooks**: `registry.registerHook('user.validate', fn)` for extensibility
  - **HTTP API**: `fetch('/api/users')` for loose coupling
- If none of these fit, the feature likely belongs in `@shared/`.

---

## 6. Test Co-Location
- **Place test files next to source**: `service.js` → `service.test.js` (same directory)
- **Use `__tests__/` only** for integration tests that span multiple files
- **Naming**: `*.test.js` for unit tests, `*.stress.test.js` for stress tests, `*.benchmark.js` for benchmarks

---

## 7. Hook Naming Convention
- **Format**: `{entity}.{action}` — e.g., `user.created`, `order.updated`, `file.deleted`
- **Channel names**: Use module name — e.g., `hook('users')`, `hook('billing')`
- **Full path**: Channel + event = `users → create`, `billing → invoice.paid`
- **Avoid**: Generic names like `data.changed` or `update`. Be specific.

---

## Instructing the AI

If you are a Developer reading this, you can append these rules to your AI prompts natively using the context commands depending on your IDE (e.g. `@rules.md` in Cursor, adding this file to Claude Projects). 

*If utilizing the unified .agent system defined in `AGENT.md`, these conventions are automatically absorbed!*
