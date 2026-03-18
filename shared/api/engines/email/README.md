# Email Engine

Multi-provider email delivery with LiquidJS template support, Zod validation, smart worker offloading, and exponential backoff retry.

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

| Field | Type | Required | Description |
|---|---|---|---|
| `to` | `string \| string[]` | ✅ | Recipients (max 50) |
| `subject` | `string` | — | Subject line (max 998 chars) |
| `html` | `string` | — | HTML body |
| `text` | `string` | — | Plain text body |
| `templateData` | `object` | — | LiquidJS `{{ variable }}` substitution |
| `templateId` | `string` | — | Provider template ID (SendGrid/Mailgun) |
| `from` / `fromName` | `string` | — | Sender (defaults from env) |
| `cc` / `bcc` | `string \| string[]` | — | CC/BCC recipients |
| `replyTo` | `string` | — | Reply-to address |
| `attachments` | `Array<{ filename, content }>` | — | Max 10 |
| `priority` | `'high' \| 'normal' \| 'low'` | — | Email priority |

> Must have at least one of: `html`, `text`, or `templateId`.

### Send Options

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `string` | configured default | Provider to use |
| `useWorker` | `boolean` | auto | Force/bypass worker offloading |
| `throwOnError` | `boolean` | `false` | Throw on send failure |
| `batchThreshold` | `number` | `5` | Emails count to trigger worker |
| `largeBodyThreshold` | `number` | `102400` | Body size (bytes) to trigger worker |
| `maxRetries` | `number` | `3` | Retry attempts for bulk (5xx only) |
| `concurrency` | `number` | `10` | Concurrent sends for bulk |

### Templates (LiquidJS)

```javascript
await email.send({
  to: 'user@example.com',
  subject: 'Hi {{name}}',
  html: '<p>Hello {{name}}</p>',
  templateData: { name: 'John' },
});
```

Renders `{{ variable }}` in `subject`, `html`, and `text`. Uses `@shared/api/engines/template`.

### Worker Control

Auto-offloads to background workers when: **5+ emails**, **100KB+ body**, or **attachments present**.

```javascript
await email.send(emails);                       // Auto-decide
await email.send(emails, { useWorker: true });   // Force worker
await email.send(emails, { useWorker: false });  // Force direct
```

### Provider Management

```javascript
email.addProvider('custom', new CustomProvider()); // No overrides
email.getProviderNames();   // ['memory', 'resend', 'smtp', ...]
email.hasProvider('smtp');   // true (triggers lazy init)
email.getProvider('smtp');   // provider instance
email.getAllStats();          // stats from all providers
await email.cleanup();       // close all connections
```

## Providers

| Provider | Transport | Config Env Var | Default |
|---|---|---|---|
| `memory` | In-memory array | — | Always available |
| `smtp` | Nodemailer | `RSK_SMTP_HOST` | Lazy init |
| `resend` | Resend HTTP API | `RSK_RESEND_KEY` | Default provider |
| `sendgrid` | SendGrid API | `RSK_SENDGRID_KEY` | Lazy init |
| `mailgun` | Mailgun API | `RSK_MAILGUN_KEY` | Lazy init |

Default provider: `RSK_MAIL_PROVIDER` env var (default: `'resend'`).
Common: `RSK_MAIL_FROM` (from address), `RSK_MAIL_FROM_NAME` (from name).

### Provider Interface

All providers implement: `send(email)`, `sendBulk(emails)`, `verify()`, `getStats()`. Optional: `close()`, `sendTemplate()`.

## Isolated Instances

```javascript
import { createFactory } from '@shared/api/engines/email';
const testEmail = createFactory({ provider: 'memory' });
```

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
