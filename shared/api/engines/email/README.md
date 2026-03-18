# Email Engine

Multi-provider email delivery with LiquidJS template support, smart worker offloading, and Zod validation.

## Quick Start

```javascript
const email = app.get('email');

await email.send({
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<p>Hello!</p>',
});
```

## API

### `email.send(emailData, options?)`

Send one or more emails. Accepts a single email object or an array for bulk.

| Option | Type | Default | Description |
|---|---|---|---|
| `useWorker` | `boolean` | auto | Force or bypass worker offloading |
| `provider` | `string` | configured default | Provider to use for delivery |

### Templates (LiquidJS)

```javascript
await email.send({
  to: 'user@example.com',
  subject: 'Hi {{name}}',
  html: '<p>Hello {{name}}</p>',
  templateData: { name: 'John' },
});
```

### Provider Management

```javascript
email.addProvider('resend', new ResendProvider());
email.getProviderNames();   // ['memory', 'smtp', 'sendgrid', 'mailgun']
email.hasProvider('smtp');
email.getProvider('smtp');
email.getAllStats();
```

### Lifecycle

```javascript
const testEmail = createFactory({ provider: 'memory' }); // Isolated instance
await email.cleanup();                                     // Graceful shutdown
```

## Providers

| Provider | Description |
|---|---|
| `memory` | In-memory (dev/testing) |
| `smtp` | SMTP via Nodemailer |
| `sendgrid` | SendGrid API |
| `mailgun` | Mailgun API |

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
