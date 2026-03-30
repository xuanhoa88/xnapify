# Webhook Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Webhook Engine at `shared/api/engines/webhook`.
> This engine manages inbound webhook handler registration with HMAC signature verification and hook-based lifecycle dispatch.

---

## Objective

Provide a managed registry for inbound webhook providers (Stripe, GitHub, Facebook, etc.) with per-provider secret storage, HMAC signature verification utilities, and priority-based lifecycle hooks for handler dispatch.

## 1. Architecture

```
shared/api/engines/webhook/
├── index.js              # Default singleton, re-exports errors + signature utils
├── factory.js            # WebhookManager class + createFactory()
├── errors.js             # WebhookError + WebhookValidationError
├── utils/
│   ├── constants.js      # WEBHOOK_EVENTS + SIGNATURE_ALGORITHMS enums
│   └── signature.js      # parseSignatureHeader + verifySignature
└── webhook.test.js       # Jest tests
```

### Dependency Graph

```
index.js
├── factory.js
│   ├── errors.js
│   └── utils/constants.js
├── errors.js
└── utils/signature.js
    ├── crypto (Node.js built-in)
    └── utils/constants.js
```

**Cross-engine dependency:** `WebhookManager.withContext()` resolves the hook engine via `container.resolve('hook')` and creates a `'webhook'` HookChannel for handler dispatch.

## 2. Error Classes (`errors.js`)

| Class | Code | Status | Extra Props | Description |
|---|---|---|---|---|
| `WebhookError` | `'WEBHOOK_ERROR'` | `500` | — | Base error with `Error.captureStackTrace` |
| `WebhookValidationError` | `'VALIDATION_ERROR'` | `400` | `field` | Invalid provider config (extends `WebhookError`) |

**Note:** Uses `status` (not `statusCode`), matching the queue engine convention.

## 3. Constants (`utils/constants.js`)

### `WEBHOOK_EVENTS`

```javascript
{ HANDLER: 'handler', BEFORE_HANDLE: 'beforeHandle', AFTER_HANDLE: 'afterHandle' }
```

- Provider handlers are registered on the hook channel as `handler:<provider>`.
- Lifecycle hooks use `beforeHandle` and `afterHandle` directly.

### `SIGNATURE_ALGORITHMS`

```javascript
{ SHA256: 'sha256', SHA512: 'sha512' }
```

## 4. Signature Utilities (`utils/signature.js`)

### `parseSignatureHeader(header) → { algorithm, signature }`

Parses header values in `algorithm=signature` format (e.g. `sha256=deadbeef`).

- `'sha256=deadbeef'` → `{ algorithm: 'sha256', signature: 'deadbeef' }`
- `'abcdef1234'` (no prefix) → `{ algorithm: 'sha256', signature: 'abcdef1234' }`
- `null` or empty → `{ algorithm: 'sha256', signature: '' }`

### `verifySignature(payload, signature, secret, algorithm?) → boolean`

Verifies an HMAC signature against a payload using **timing-safe comparison**.

- Stringifies object payloads via `JSON.stringify`.
- Creates HMAC with `crypto.createHmac(algorithm, secret).update(data).digest('hex')`.
- Guards against length mismatch before calling `crypto.timingSafeEqual`.
- Returns `false` for empty signature or empty secret.
- Default algorithm: `sha256`.

## 5. WebhookManager Class (`factory.js`)

### Private State (Symbols)

- `Symbol('__xnapify.webhookChannel__')` → `HookChannel|null` — injected via `withContext()`.
- `Symbol('__xnapify.webhookContext__')` → `Object|null` — DI container.
- `Symbol('__xnapify.webhookProviders__')` → `Map<provider, { secret, signatureHeader }>`.

### `withContext(container) → this`

Binds the manager to a DI container. Called automatically by `registerEngines()` during bootstrap.

- Stores `container` in `CONTEXT` symbol.
- Resolves hook engine via `container.resolve('hook')`.
- Creates a `'webhook'` HookChannel via `hook('webhook')`.
- Returns `this` for chaining.

### `handler(provider, config) → this`

Registers a webhook handler for a provider. Returns `this` for chaining.

**Validation (throws `WebhookValidationError`):**
1. `provider` must be a non-empty string (field: `'provider'`).
2. `config` must be a non-null object (field: `'config'`).
3. `config.secret` must be a non-empty string (field: `'secret'`).
4. `config.handler` must be a function (field: `'handler'`).

**Config params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `secret` | `string` | *required* | Shared secret for HMAC verification |
| `signatureHeader` | `string` | `'x-webhook-signature'` | Request header containing signature (lowercased on storage) |
| `handler` | `Function` | *required* | `async (payload, enrichedContext) => void` |
| `priority` | `number` | `10` | Hook priority (lower runs first) |

**Internal behavior:**
- Stores `{ secret, signatureHeader }` in providers map.
- Registers handler on the hook channel as event `handler:<provider>` with given priority.

### `removeHandler(provider) → this`

Deletes provider from the map and calls `hook.off('handler:<provider>')`. Returns `this` for chaining. Safe for non-existent providers.

### `hasHandler(provider) → boolean`

Checks if provider is in the providers map.

### `getProviderConfig(provider) → { secret, signatureHeader } | null`

Returns stored config or `null`.

### `getProviders() → string[]`

Returns array of registered provider names.

### `dispatch(provider, payload, context) → Promise<void>`

Called by the controller after signature verification passes. Executes the lifecycle in sequence:

1. **Enrich context:** merges `context` with `{ container: this[CONTEXT] }`.
2. **`beforeHandle`:** emits `WEBHOOK_EVENTS.BEFORE_HANDLE` with `{ provider, payload, ...enrichedContext }`.
3. **Provider handler:** emits `handler:<provider>` with `(payload, enrichedContext)`.
4. **`afterHandle`:** emits `WEBHOOK_EVENTS.AFTER_HANDLE` with `{ provider, payload, ...enrichedContext }`.

**Context shape passed to handlers:**
```javascript
{
  headers: object,  // Request headers
  query: object,    // Query parameters
  ip: string,       // Client IP
  container: object, // DI container
}
```

**Error propagation:** Errors from handlers propagate to the caller (no internal catch).

### `on(event, handlerFn, priority?) → this`

Register a lifecycle hook (`beforeHandle`, `afterHandle`). Delegates to `HookChannel.on()`. Returns `this` for chaining.

### `off(event, handlerFn?) → this`

Remove a lifecycle hook. Delegates to `HookChannel.off()`. Returns `this` for chaining.

### `cleanup()`

Calls `hook.off()` (clears all handlers) and clears the providers map. Safe for multiple calls.

## 6. Factory Function: `createFactory()`

**File:** `factory.js`

Returns a new `WebhookManager` instance. Unlike the hook/queue engines, the factory is **not callable** — it returns the manager object directly.

## 7. Default Singleton

**File:** `index.js`

### Named Exports
- `createFactory` — factory function for isolated instances
- `WebhookError`, `WebhookValidationError` — error classes (re-exported from `errors.js`)
- `parseSignatureHeader`, `verifySignature` — signature utils (re-exported from `utils/signature.js`)

### Default Export
```javascript
const webhook = createFactory();
export default webhook;
```

The singleton is registered on the DI container via `container.instance('webhook', webhook)` during engine autoloading. `withContext()` is called during bootstrap to bind the hook engine.

## 8. Testing

**File:** `webhook.test.js`

Uses a helper `createWebhook()` that creates a factory instance and binds it with `withContext({ resolve: () => createHookFactory() })` to simulate bootstrap.

### Test Coverage (8 describe blocks)

**Default Instance:**
- Has all expected methods (`handler`, `removeHandler`, `hasHandler`, `getProviders`, `getProviderConfig`, `dispatch`, `on`, `off`, `cleanup`).

**createFactory():**
- Independent instances don't share state.

**Handler Registration:**
- Registration with secret and signatureHeader.
- Provider config storage and retrieval.
- Default signature header (`x-webhook-signature`).
- Method chaining.
- Validation errors: missing provider, missing secret, missing handler, invalid config.

**Handler Removal:**
- Removal clears provider config and hook handler.
- Safe for non-existent providers.
- Method chaining.

**Dispatch:**
- Payload dispatched to handler with enriched context (includes `container`).
- `beforeHandle` → handler → `afterHandle` execution order.
- Provider info passed to lifecycle hooks.
- Handler errors propagate (rejects).

**Signature Utilities:**
- `parseSignatureHeader`: `sha256=...`, `sha512=...`, no prefix, null input.
- `verifySignature`: valid/invalid signatures, sha256/sha512, string payload, empty signature/secret, length mismatch, consistency.

**Constants:**
- `WEBHOOK_EVENTS` values.
- `SIGNATURE_ALGORITHMS` values.

**Error Classes:**
- `WebhookError` properties and inheritance.
- `WebhookValidationError` field and status.

**Cleanup:**
- Clears all providers and handlers.
- Multiple cleanup calls safe.

**Lifecycle Hooks:**
- Register and remove lifecycle hooks via `on`/`off`.
- Method chaining.

## 9. Integration Points

- **Bootstrap**: `registerEngines()` calls `webhook.withContext(container)` to inject the hook engine.
- **Controller layer**: `POST /api/webhooks/:provider` reads raw body, verifies HMAC via `verifySignature`, then calls `webhook.dispatch()`.
- **Module `boot({ container })`**: Modules register providers via `container.resolve('webhook').handler(...)`.
- **Hook engine**: The webhook engine uses a dedicated `'webhook'` HookChannel for all internal dispatch.

---

*Note: This spec reflects the CURRENT implementation of the webhook engine.*
