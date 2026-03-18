---
description: Add a webhook handler with secret verification and hook registration
---

Add a webhook handler that integrates with the webhook engine (`@shared/api`).

## How Webhooks Work

The webhook engine dispatches incoming HTTP payloads to registered handlers. Handlers are registered via the hook system during module `init()`. Signature verification is handled automatically.

## Step-by-Step

### 1. Register Webhook Handler in Module Init

```javascript
// src/apps/{module-name}/api/index.js — inside init()
export async function init(app) {
  const webhook = app.get('webhook');

  webhook.register('{provider-name}', {
    secret: process.env.RSK_WEBHOOK_{PROVIDER}_SECRET,
    handler: async (payload, { headers, query, ip, app }) => {
      const event = headers['x-webhook-event'];

      switch (event) {
        case 'payment.completed':
          await handlePaymentCompleted(payload, app);
          break;
        case 'subscription.cancelled':
          await handleSubscriptionCancelled(payload, app);
          break;
        default:
          console.warn(`[Webhook] Unhandled event: ${event}`);
      }
    },
  });
}
```

### 2. Add Secret to Environment

```bash
# .env
RSK_WEBHOOK_{PROVIDER}_SECRET=your-webhook-secret-here
```

Add the same variable to `.env.rsk` template with a comment.

### 3. Create Handler Functions

```javascript
// src/apps/{module-name}/api/services/webhook.service.js

export async function handlePaymentCompleted(payload, app) {
  const { db } = app.get('db');
  // Process payment webhook
}

export async function handleSubscriptionCancelled(payload, app) {
  // Process cancellation
}
```

### 4. Write Tests

// turbo
```bash
npm run test -- webhook
```

```javascript
describe('{Provider} Webhook Handler', () => {
  it('should handle payment.completed event', async () => {
    const payload = { /* mock payload */ };
    const result = await handlePaymentCompleted(payload, mockApp);
    expect(result).toBeDefined();
  });
});
```

### 5. Run Full Suite

// turbo
```bash
npm test
```
