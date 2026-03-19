# Email Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Email Engine at `shared/api/engines/email`.
> This engine provides multi-provider email delivery with template rendering, Zod validation, smart worker offloading, and extensible provider registration.

---

## Objective

Provide a multi-provider email delivery system with LiquidJS template rendering, Zod-based validation, smart worker offloading, exponential backoff retry, and extensible provider registration.

## 1. Architecture

```
shared/api/engines/email/
├── index.js              # Default singleton + services re-export
├── factory.js            # EmailManager class + createFactory()
├── providers/
│   ├── memory.js         # In-memory (testing/dev)
│   ├── smtp.js           # SMTP via Nodemailer
│   ├── resend.js         # Resend HTTP API
│   ├── sendgrid.js       # SendGrid API
│   └── mailgun.js        # Mailgun API
├── services/
│   ├── index.js          # Re-exports
│   └── send.js           # Worker-enabled send service
├── utils/
│   ├── constants.js      # EMAIL_VALIDATED symbol
│   ├── errors.js         # EmailError + EmailWorkerError
│   ├── validation.js     # Zod schemas + EMAIL_LIMITS
│   └── processing.js     # Template rendering, retry, bulk processing
├── workers/
│   ├── index.js          # Worker pool with processSend()
│   └── send.worker.js    # Worker handler
└── email.test.js         # Jest tests
```

### Dependency Graph

```
index.js
└── factory.js
    ├── providers/* (nodemailer, node-fetch)
    └── services/send.js
        ├── utils/validation.js (@shared/validator → zod)
        ├── utils/processing.js (@shared/api/engines/template)
        ├── utils/errors.js (@shared/api/engines/worker → WorkerError)
        └── workers/index.js (@shared/api/engines/worker → createWorkerPool)
```

## 2. EmailManager Class (`factory.js`)

### Constructor

```javascript
new EmailManager({ provider, smtp, resend, sendgrid, mailgun, memory, workerThresholds })
```

- **Always** registers `MemoryEmailProvider` (unconditional).
- Other providers are **lazily initialized** on first access via `lazyInitProvider(name)`.

### Default Provider Resolution

```
config.provider → RSK_MAIL_PROVIDER env → 'resend'
```

Evaluated dynamically via getter (not at construction time), allowing late-loaded env vars.

### Lazy Provider Initialization

Each provider is created only when requested (via `getProvider`, `hasProvider`, or `getProviderNames`):

| Provider | Trigger Condition | Env Vars |
|---|---|---|
| `smtp` | `config.smtp` or `RSK_SMTP_HOST` or default is `'smtp'` | `RSK_SMTP_HOST`, `RSK_SMTP_PORT` (587), `RSK_SMTP_SECURE`, `RSK_SMTP_USER`, `RSK_SMTP_PASS` |
| `resend` | `config.resend` or `RSK_RESEND_KEY` | `RSK_RESEND_KEY` |
| `sendgrid` | `config.sendgrid` or `RSK_SENDGRID_KEY` | `RSK_SENDGRID_KEY` |
| `mailgun` | `config.mailgun` or `RSK_MAILGUN_KEY` | `RSK_MAILGUN_KEY`, `RSK_MAILGUN_DOMAIN`, `RSK_MAILGUN_REGION` (`'us'`) |

All providers share: `RSK_MAIL_FROM` (from address), `RSK_MAIL_FROM_NAME` (falls back to `RSK_APP_NAME`).

### Provider Management

| Method | Returns | Description |
|---|---|---|
| `addProvider(name, instance)` | `boolean` | Register custom. **Refuses overrides** (logs warning). |
| `getProvider(name)` | provider or `null` | Get by name (triggers lazy init). |
| `getProviderNames()` | `string[]` | Lists all available (triggers lazy init for all 4 standard providers). |
| `hasProvider(name)` | `boolean` | Check existence (triggers lazy init). |
| `getAllStats()` | `object` | Stats from all providers. |
| `cleanup()` | `Promise<void>` | Calls `provider.close()` on all, then clears map. |

### `send(emails, options?) → Promise<Object>`

Delegates to `services/send.js`. See §3.

## 3. Send Service (`services/send.js`)

### Pipeline

1. **Normalize** — wraps single email in array.
2. **Validate** — `validateEmails()` via Zod schema. Returns `createOperationResult(false, ...)` on failure.
3. **Worker decision** — `makeSendDecision()`.
4. **Execute** — worker pool or direct via `processEmails()`.

### Worker Auto-Decision

| Condition | Default Threshold | Triggers Worker |
|---|---|---|
| Batch size | `5` emails | ✅ |
| Large body | `100KB` (html or text) | ✅ |
| Attachments | Any email has attachments | ✅ |

Override: `options.useWorker = true/false`. Thresholds configurable via `options.batchThreshold` / `options.largeBodyThreshold`.

### `throwOnError` Support

When `options.throwOnError` is set:
- Provider not found → throws `EmailError` (`PROVIDER_NOT_FOUND`, 404)
- Send failure → throws `EmailError` (`SEND_FAILED`, 500)

## 4. Validation (`utils/validation.js`)

### `EMAIL_LIMITS`

| Limit | Value | Description |
|---|---|---|
| `MAX_RECIPIENTS` | `50` | Max recipients per email |
| `MAX_BATCH_SIZE` | `100` | Max emails per `send()` call |
| `MAX_ATTACHMENTS` | `10` | Max attachments per email |
| `MAX_BODY_SIZE` | `10MB` | Max html/text body size |

### Email Item Schema (Zod)

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | `string \| string[]` | ✅ | Email validated, max 50 |
| `cc` | `string \| string[]` | — | Max 50 |
| `bcc` | `string \| string[]` | — | Max 50 |
| `subject` | `string` | — | Max 998 chars |
| `html` | `string` | — | Max 10MB |
| `text` | `string` | — | Max 10MB |
| `templateData` | `Record<string, any>` | — | LiquidJS variables |
| `templateId` | `string` | — | Provider template (SendGrid/Mailgun) |
| `from` | `string` | — | Email validated |
| `fromName` | `string` | — | Max 255 chars |
| `replyTo` | `string` | — | Email validated |
| `attachments` | `Array<{ filename, content, contentType?, disposition? }>` | — | Max 10 |
| `headers` | `Record<string, string>` | — | Custom headers |
| `priority` | `'high' \| 'normal' \| 'low'` | — | |

**Refinement**: Must have `html`, `text`, or `templateId` (at least one).

## 5. Processing (`utils/processing.js`)

### Template Rendering

Uses `@shared/api/engines/template` (LiquidJS). Renders `{{ variable }}` in `html`, `text`, and `subject` when `templateData` is provided. Errors caught gracefully — returns original content on failure.

### Provider Template Support

If `templateId` is set, calls `provider.sendTemplate(templateId, templateData, to, options)`. Throws `TEMPLATE_NOT_SUPPORTED` (400) if provider doesn't implement it.

### Retry Logic

`sendWithRetry(fn, maxRetries=3)` — exponential backoff (1s, 2s, 4s):
- **Retries** on 5xx server errors.
- **Does not retry** on 4xx client errors.

### Bulk Processing

`processEmails(provider, emailList, options)`:
- Single email → direct send, returns `{ messageId, to, provider, sentAt }`.
- Bulk → chunked with `concurrency` (default `10`), retry per email. Returns `{ successful: [], failed: [], totalEmails, successCount, failCount }`.

## 6. Providers

All providers implement: `send(email)`, `sendBulk(emails)`, `verify()`, `getStats()`. Optional: `close()`, `sendTemplate()`.

### Memory Provider

| Config | Default | Description |
|---|---|---|
| `defaultFrom` | `'test@example.com'` | |
| `defaultFromName` | `'Test Sender'` | |
| `maxStoredEmails` | `1000` | |
| `simulateDelay` | `0` ms | |
| `failureRate` | `0` (0–1) | Random failure simulation |

Extra methods: `getSentEmails(filters)`, `getEmailById(id)`, `getLastEmail()`, `getFailedEmails()`, `clear()`.

### SMTP Provider

| Config | Default | Description |
|---|---|---|
| `host` | `'localhost'` | SMTP host |
| `port` | `587` | SMTP port |
| `secure` | `false` | TLS |
| `auth` | from `user`/`pass` | Auth credentials |
| `pool` | `true` | Connection pooling |
| `maxConnections` | `5` | Pool connections |
| `maxMessages` | `100` | Messages per connection |

Uses Nodemailer with lazy transporter creation. `close()` closes the connection pool.

### Resend Provider

Config: `apiKey`, `apiUrl` (default: `https://api.resend.com/emails`), `defaultFrom`, `defaultFromName`.
HTTP API via `node-fetch`. `verify()` tests against `/api-keys` endpoint.

### SendGrid / Mailgun Providers

Similar pattern. Env vars: `RSK_SENDGRID_KEY` / `RSK_MAILGUN_KEY` + `RSK_MAILGUN_DOMAIN` + `RSK_MAILGUN_REGION`.

## 7. Worker Pool (`workers/index.js`)

```javascript
createWorkerPool('📧 Email', workersContext, { ErrorHandler: EmailWorkerError, ...WORKER_CONFIG })
```

### Worker Configuration (env vars)

| Env Var | Default | Description |
|---|---|---|
| `RSK_MAIL_WORKERS` | `4` | Max workers |
| `RSK_MAIL_WORKER_TIMEOUT` | `60000` ms | Worker timeout |
| `RSK_MAIL_WORKER_MAX_REQ` | `100` | Max requests per worker |

### Methods

| Method | Worker | Message | `forceFork` |
|---|---|---|---|
| `processSend(emails, options)` | `send` | `SEND_EMAIL` | ✅ |
| `unregisterSend()` | `send` | — | — |

The `EMAIL_VALIDATED` flag is passed in options so the worker skips re-validation.

## 8. Error Classes

| Class | Extends | Code Default | Status |
|---|---|---|---|
| `EmailError` | `Error` | `'PROVIDER_ERROR'` | `500` |
| `EmailWorkerError` | `WorkerError` | `'WORKER_ERROR'` | `500` |

### `createOperationResult(success, data?, message?, error?)`

Returns `{ success, data, message, timestamp, error? }`. Stack trace included in development mode.

## 9. Default Singleton

**File:** `index.js`

```javascript
const email = createFactory();
```

- Named exports: `createFactory`, `services`.
- Default export: singleton `EmailManager`.
- Registered on DI as `container.resolve('email')`.

## 10. Environment Variables Summary

| Var | Default | Used By |
|---|---|---|
| `RSK_MAIL_PROVIDER` | `'resend'` | Default provider selection |
| `RSK_MAIL_FROM` | — | From address (all providers) |
| `RSK_MAIL_FROM_NAME` | `RSK_APP_NAME` | From name (all providers) |
| `RSK_SMTP_HOST` | `'localhost'` | SMTP provider |
| `RSK_SMTP_PORT` | `587` | SMTP provider |
| `RSK_SMTP_SECURE` | `'false'` | SMTP TLS |
| `RSK_SMTP_USER` | — | SMTP auth |
| `RSK_SMTP_PASS` | — | SMTP auth |
| `RSK_RESEND_KEY` | — | Resend provider |
| `RSK_SENDGRID_KEY` | — | SendGrid provider |
| `RSK_MAILGUN_KEY` | — | Mailgun provider |
| `RSK_MAILGUN_DOMAIN` | — | Mailgun provider |
| `RSK_MAILGUN_REGION` | `'us'` | Mailgun region |
| `RSK_MAIL_WORKERS` | `4` | Worker pool |
| `RSK_MAIL_WORKER_TIMEOUT` | `60000` | Worker timeout |
| `RSK_MAIL_WORKER_MAX_REQ` | `100` | Worker max requests |

---

*Note: This spec reflects the CURRENT implementation of the email engine.*
