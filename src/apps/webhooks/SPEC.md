# Webhooks Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the webhook architecture inside `src/apps/webhooks`.
> This module owns the webhook engine: factory, errors, signature utilities, and API routes.

---

## Objective

Provide a unified inbound webhook handling system for third-party service integrations (Stripe, GitHub, Facebook, etc.) with HMAC signature verification, priority-based handler dispatch via the hook engine, and lifecycle hooks (beforeHandle/afterHandle).

## 1. Architecture

```
src/apps/webhooks/
├── package.json
├── SPEC.md                              # This file
└── api/
    ├── index.js                         # Lifecycle hooks (providers, boot, routes)
    ├── factory.js                       # WebhookManager class + createFactory()
    ├── errors.js                        # WebhookError, WebhookValidationError
    ├── webhook.test.js                  # Comprehensive test suite (489 lines)
    ├── utils/
    │   ├── constants.js                 # WEBHOOK_EVENTS, SIGNATURE_ALGORITHMS
    │   └── signature.js                 # parseSignatureHeader(), verifySignature()
    └── routes/
        ├── (admin)/
        │   └── (default)/
        │       └── _route.js            # GET /api/admin/webhooks (list providers)
        └── [provider]/
            └── _route.js                # POST /api/webhooks/:provider (inbound handler)
```

## 2. WebhookManager (`factory.js`)

### Core Methods

| Method | Signature | Description |
|---|---|---|
| `withContext(container)` | `(DI container) → this` | Binds to DI, creates hook channel |
| `handler(provider, config)` | `(string, { secret, signatureHeader?, handler, priority? }) → this` | Register provider handler |
| `removeHandler(provider)` | `(string) → this` | Remove a provider |
| `hasHandler(provider)` | `(string) → boolean` | Check if provider exists |
| `getProviderConfig(provider)` | `(string) → { secret, signatureHeader } \| null` | Get provider config |
| `getProviders()` | `() → string[]` | List all provider names |
| `dispatch(provider, payload, context)` | `(string, *, { headers, query, ip }) → Promise<void>` | Dispatch to handlers |
| `on(event, handler, priority?)` | `(string, Function, number?) → this` | Register lifecycle hook |
| `off(event, handler?)` | `(string, Function?) → this` | Remove lifecycle hook |
| `cleanup()` | `() → void` | Clear all handlers + providers |
| `parseSignatureHeader(header)` | `(string) → { algorithm, signature }` | Parse signature header |
| `verifySignature(payload, sig, secret, algo?)` | `(...) → boolean` | HMAC verification |

### Dispatch Flow

```
beforeHandle → handler:<provider> → afterHandle
```

Uses the `hook` engine's HookChannel for priority-based sequential execution.

## 3. Signature Verification (`utils/signature.js`)

- **`parseSignatureHeader(header)`** — Parses `sha256=deadbeef` into `{ algorithm, signature }`
- **`verifySignature(payload, signature, secret, algorithm)`** — Timing-safe HMAC comparison using `crypto.timingSafeEqual()`

Supported algorithms: `sha256`, `sha512`.

## 4. Error Classes (`errors.js`)

| Error | Status | When |
|---|---|---|
| `WebhookError` | 500 | Base error class |
| `WebhookValidationError` | 400 | Invalid provider config, missing secret/handler |

## 5. Module Lifecycle (`api/index.js`)

| Phase | Hook | Description |
|---|---|---|
| `providers` | `providers({ container })` | Binds `'webhook'` via lazy `container.bind()` with `withContext()` |
| `boot` | `boot({ container })` | Forces `resolve('webhook')` to initialize before extensions |
| `routes` | `() => routesContext` | Mounts admin and inbound routes |

## 6. API Routes

### Admin Route
- **`GET /api/admin/webhooks`** — Lists registered providers. Requires `webhooks:read` permission.

### Inbound Webhook Route
- **`POST /api/webhooks/:provider`** — Inbound handler. `middleware = false` (uses HMAC instead of auth).
  1. Check provider registered → 404
  2. Read signature header → 401 if missing
  3. Verify HMAC → 401 if invalid
  4. Respond 202 Accepted + async dispatch

## 7. Extension Integration

Extensions register webhook handlers in their `boot()`:

```javascript
async boot({ container }) {
  const webhook = container.resolve('webhook');
  webhook.handler('stripe', {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    signatureHeader: 'stripe-signature',
    handler: async (payload, context) => {
      await processStripeEvent(payload);
    },
  });
}
```

---

*Note: This spec reflects the CURRENT implementation of the webhooks module.*
