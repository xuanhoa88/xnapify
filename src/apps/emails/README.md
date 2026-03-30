# Core Module AI Instructions

This folder (`src/apps/emails/`) is a **Core Module**.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Local Module Constraints
Unlike Extensions, Core Modules are fully woven into the backend architecture.
1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

## Container Services

This module registers the following container bindings in `providers()`:

| Key | Type | Description |
|---|---|---|
| `emails:send` | `Function` | Global templated email service. Any module or extension can resolve and use it. |

### Usage from other modules

```javascript
// In any module's boot() hook or service
const sendTemplatedEmail = container.resolve('emails:send');

await sendTemplatedEmail(
  'welcome-email',                          // DB template slug
  { to: email, subject: 'Welcome', html: '<p>Hi {{ name }}</p>' },
  { name: displayName },                    // Template variables
);
```

### Usage from extensions (via hook)

```javascript
// In any extension's boot() hook
const hook = container.resolve('hook');

await hook('emails').emit('send', {
  slug: 'order-confirmation',
  to: 'customer@example.com',
  subject: 'Order #{{ orderId }}',
  html: '<p>Your order is confirmed.</p>',
  data: { orderId: 42 },
});
```

## Architecture Notes

- **Template Engine**: LiquidJS (`{{ variable }}` syntax, `{% %}` tags)
- **Base Variables**: `appName`, `loginUrl`, `resetUrl`, `supportUrl`, `now`, `year` — auto-injected into every email
- **DB Override**: If a `slug` matches an active `EmailTemplate`, its `subject`/`html_body`/`text_body` override inline fallbacks
- **Error Handling**: `sendTemplatedEmail` never throws — failures are logged via `console.warn`
- **Preview Security**: Admin preview uses sandboxed iframe with `allow-popups` only (no `allow-scripts`, no `allow-same-origin`)

Always prioritize these local boundary constraints when refactoring or building new features within this module.
