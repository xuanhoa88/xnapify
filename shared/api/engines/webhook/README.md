# Webhook Engine

Inbound webhook handler registration with automatic HMAC signature verification, lifecycle hooks, and provider management.

## Quick Start

```javascript
const webhook = app.get('webhook');

webhook.handler('stripe', {
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  signatureHeader: 'stripe-signature',
  handler: async (payload, context) => {
    await processStripeEvent(payload);
  },
});
```

## API

### `webhook.handler(provider, config)`

Register a webhook handler for a provider.

| Param | Type | Description |
|---|---|---|
| `provider` | `string` | Provider name (e.g., `stripe`, `github`) |
| `config.secret` | `string` | HMAC secret for signature verification |
| `config.signatureHeader` | `string` | Header containing the signature |
| `config.handler` | `Function` | Async handler `(payload, context) => void` |

### Lifecycle Hooks

```javascript
webhook.on('beforeHandle', async ({ provider, payload }) => { /* ... */ });
webhook.on('afterHandle', async ({ provider, payload }) => { /* ... */ });
```

### Management

| Method | Description |
|---|---|
| `removeHandler(provider)` | Unregister a provider |
| `getProviders()` | List registered providers |

### Isolated Instances

```javascript
import { createFactory } from '@shared/api/engines/webhook';
const myWebhook = createFactory();
```

## Signature Verification

The controller automatically verifies HMAC signatures using the registered secret and signature header before dispatching to handlers. Utilities are exported from `utils/signature`.

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
