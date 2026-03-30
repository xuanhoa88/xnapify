# Webhooks Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the webhook routing logic inside `src/apps/webhooks`.
> This module provides admin management and inbound webhook handling for third-party integrations.

---

## Objective

Expose admin endpoints for listing registered webhook providers and an inbound endpoint for receiving and verifying third-party webhook payloads via HMAC signature verification.

## 1. Database Modifications (`api/models`)

*The webhooks module does not own its own models.* It relies on the shared `webhook` engine (`shared/api/engines/webhook`) for provider registration, signature verification, and handler dispatch.

## 2. API Routes & Controllers (`api/`)

### Admin Route

- **Method & Path:** `GET /api/admin/webhooks`
  - **Security:** Requires `webhooks:read` permission.
  - **Logic:** Lists all registered webhook providers retrieved from the webhook engine via `webhook.getProviders()`. Returns each provider's name and active handler status.

### Inbound Webhook Route

- **Method & Path:** `POST /api/webhooks/:provider`
  - **Security:** `export const middleware = false` — bypasses auth middleware. Uses HMAC signature verification instead.
  - **Flow:**
    1. Checks provider is registered → 404 if not
    2. Reads signature from configured header (`config.signatureHeader`) → 401 if missing
    3. Parses and verifies HMAC signature against secret → 401 if invalid
    4. Responds `202 Accepted` immediately (fire-and-forget)
    5. Dispatches to registered handler(s) asynchronously via `webhook.dispatch()`
  - **Error handling:** Handler errors are caught and logged but do not affect the 202 response.

## 3. Frontend SSR Rendering (`views/`)

*The webhooks module has no frontend views.* It is API-only. Admin webhook management UI can be added in the future.

## 4. Integration with Webhook Engine

The module routes are thin wrappers around the `webhook` engine service:

| Engine Method | Used By | Purpose |
|---|---|---|
| `webhook.getProviders()` | Admin list route | Returns array of registered provider names |
| `webhook.hasHandler(name)` | Both routes | Checks if a provider exists |
| `webhook.getProviderConfig(name)` | Inbound route | Gets secret and signature header config |
| `webhook.parseSignatureHeader(raw)` | Inbound route | Extracts algorithm and signature from header |
| `webhook.verifySignature(body, sig, secret, algo)` | Inbound route | HMAC verification |
| `webhook.dispatch(name, body, context)` | Inbound route | Async handler dispatch |

---
*Note: This spec reflects the CURRENT implementation of the webhooks module.*
