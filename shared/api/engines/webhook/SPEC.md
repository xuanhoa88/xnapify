# Webhook Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Webhook Engine at `shared/api/engines/webhook`.

---

## Objective

Provide inbound webhook endpoints for 3rd-party services with automatic HMAC signature verification and hook-based handler dispatch.

## 1. Architecture

```
shared/api/engines/webhook/
├── index.js          # Default singleton, re-exports errors + signature utils
├── factory.js        # WebhookManager class + createFactory()
├── errors.js         # WebhookError class
├── utils/
│   └── signature.js  # HMAC signature verification utilities
└── webhook.test.js   # Jest tests
```

## 2. WebhookManager (`factory.js`)

- Provider registry: `Map<provider, { secret, signatureHeader, handler }>`.
- Uses `HookChannel` internally for priority-based handler dispatch.
- `handler(provider, config)` — registers provider with secret + handler.
- `removeHandler(provider)` — unregisters.
- `getProviders()` — lists registered provider names.
- Lifecycle hooks via internal HookChannel: `beforeHandle`, `afterHandle`.

## 3. Signature Verification

- `utils/signature.js` exports verification helpers.
- HMAC-SHA256 verification using the registered `secret` against the `signatureHeader`.
- Verification happens in the controller layer before handler dispatch.

## 4. Controller Integration

The webhook engine exposes `POST /api/webhooks/:provider` which:
1. Reads raw body
2. Verifies HMAC signature
3. Emits `beforeHandle` lifecycle hook
4. Dispatches to registered handler
5. Emits `afterHandle` lifecycle hook

## 5. Default Singleton

`index.js` exports `createFactory()`. Registered on DI as `app.get('webhook')`.

---

*Note: This spec reflects the CURRENT implementation of the webhook engine.*
