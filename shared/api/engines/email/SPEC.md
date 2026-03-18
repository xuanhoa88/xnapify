# Email Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Email Engine at `shared/api/engines/email`.

---

## Objective

Provide a multi-provider email delivery system with template rendering, validation, smart worker offloading, and extensible provider registration.

## 1. Architecture

```
shared/api/engines/email/
├── index.js          # Default singleton, re-exports services
├── factory.js        # EmailManager class + createFactory()
├── providers/        # Provider adapters (SMTP, SendGrid, Mailgun, Memory)
├── services/         # Exported service functions
├── utils/            # Validation (Zod), template rendering
├── workers/          # Background worker handlers
└── email.test.js     # Jest tests
```

## 2. EmailManager (`factory.js`)

- Manages a registry of providers (`Map<name, provider>`).
- `send(emailData, options)` — validates via Zod, renders templates via LiquidJS, auto-decides worker vs direct based on batch size/body size/attachments.
- `addProvider(name, instance)` — registers a custom provider (cannot override existing).
- `getProviderNames()`, `hasProvider()`, `getProvider()`, `getAllStats()`, `cleanup()`.

## 3. Smart Worker Offloading

The engine auto-offloads to background workers when:
- Batch contains ≥5 emails
- Body size exceeds threshold
- Attachments are present

Override with `{ useWorker: true/false }`.

## 4. Template Rendering

Uses the Template Engine (`@shared/api/engines/template`) for LiquidJS processing. Pass `templateData` in the email object to render `{{ variable }}` placeholders in subject and body.

## 5. Default Singleton

`index.js` exports `createFactory()`. Registered on DI as `app.get('email')`.

---

*Note: This spec reflects the CURRENT implementation of the email engine.*
