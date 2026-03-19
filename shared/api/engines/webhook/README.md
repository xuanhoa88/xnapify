# Webhook Engine

Inbound webhook handler registration with HMAC signature verification, lifecycle hooks, and provider management. Manages secrets and dispatch for 3rd-party services (Stripe, GitHub, Facebook, etc.).

## Quick Start

```javascript
const webhook = app.get('container').resolve('webhook');

webhook.handler('stripe', {
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  signatureHeader: 'stripe-signature',
  handler: async (payload, context) => {
    // context.app — DI container
    // context.headers, context.query, context.ip — request info
    await processStripeEvent(payload);
  },
});
```

## API

### `webhook.handler(provider, config) → this`

Register a webhook handler for a provider. Chainable.

| Param | Type | Default | Description |
|---|---|---|---|
| `provider` | `string` | *required* | Provider name (e.g. `'stripe'`, `'github'`) |
| `config.secret` | `string` | *required* | HMAC shared secret |
| `config.signatureHeader` | `string` | `'x-webhook-signature'` | Header containing the signature |
| `config.handler` | `Function` | *required* | `async (payload, context) => void` |
| `config.priority` | `number` | `10` | Execution priority (lower runs first) |

Throws `WebhookValidationError` for invalid provider, missing secret, or non-function handler.

### `webhook.removeHandler(provider) → this`

Unregister a provider. After removal, the endpoint returns 404. Chainable, safe for non-existent providers.

### `webhook.hasHandler(provider) → boolean`

Check if a provider is registered.

### `webhook.getProviderConfig(provider) → { secret, signatureHeader } | null`

Get provider's stored config.

### `webhook.getProviders() → string[]`

List all registered provider names.

### `webhook.dispatch(provider, payload, context) → Promise<void>`

Dispatch an incoming webhook. Called by the controller after signature verification. Executes: `beforeHandle` → handler → `afterHandle`.

### Lifecycle Hooks

```javascript
webhook.on('beforeHandle', async ({ provider, payload, headers, app }) => {
  console.log(`Incoming webhook from ${provider}`);
});

webhook.on('afterHandle', async ({ provider, payload }) => {
  await logWebhookEvent(provider, payload);
});

// Remove a lifecycle hook
webhook.off('beforeHandle', myHandler);
```

### `webhook.cleanup()`

Clear all providers and handlers.

## Signature Verification

The controller layer automatically verifies signatures. Utilities are also exported for custom use:

```javascript
import { verifySignature, parseSignatureHeader } from '@shared/api/engines/webhook';

// Parse "sha256=deadbeef" → { algorithm: 'sha256', signature: 'deadbeef' }
const { algorithm, signature } = parseSignatureHeader(req.headers['x-hub-signature-256']);

// Timing-safe HMAC verification
const isValid = verifySignature(rawBody, signature, secret, algorithm);
```

Supports `sha256` (default) and `sha512`. Uses `crypto.timingSafeEqual` to prevent timing attacks.

## Error Classes

```javascript
import { WebhookError, WebhookValidationError } from '@shared/api/engines/webhook';

// WebhookError — base (code: 'WEBHOOK_ERROR', status: 500)
// WebhookValidationError — invalid config (code: 'VALIDATION_ERROR', status: 400, field: string)
```

## Isolated Instances

```javascript
import { createFactory } from '@shared/api/engines/webhook';
const myWebhook = createFactory();
myWebhook.withContext(app); // Must bind hook engine before use
```

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
