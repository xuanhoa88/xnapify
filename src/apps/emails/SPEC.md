# Emails Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the email template management logic inside `src/apps/emails`.
> This module allows administrators to design, preview, and manage system email templates using LiquidJS.

---

## Objective
Provide a robust system for managing transactional email templates with real-time preview, dynamic content injection, and a hook-based API for extensions.

## 1. Database Modifications (`api/models`)
- **Model:** `EmailTemplate`
- **Columns:**
  - `id`: UUID (Primary Key)
  - `name`: String (Human readable name)
  - `slug`: String (Unique machine key, e.g. `welcome-email`)
  - `subject`: String (Email subject line, supports LiquidJS)
  - `html_body`: Text (Email HTML content, supports LiquidJS)
  - `text_body`: Text (Plain-text fallback, supports LiquidJS)
  - `is_active`: Boolean (Active/draft status)
  - `sample_data`: JSON (Sample template variables for admin preview)

## 2. Container Services

The email module registers a global service on the DI container:

| Service Key | Type | Description |
|---|---|---|
| `emails:send` | `Function` | `sendTemplatedEmail(slug, defaultPayload, templateData)` |

### `emails:send` — Global Templated Email Service

Registered in `providers()` lifecycle. Any module or extension can resolve it:

```javascript
const sendTemplatedEmail = container.resolve('emails:send');

await sendTemplatedEmail(
  'order-confirmation',                    // DB template slug
  {                                         // Fallback content
    to: 'customer@example.com',
    subject: 'Order #{{ orderId }}',
    html: '<p>Hi {{ name }}, your order is confirmed.</p>',
  },
  { name: 'John', orderId: 42 },           // Template variables
);
```

#### Base Variables (auto-injected)
Every email automatically receives these variables via `baseVars()`:

| Variable | Source | Example |
|---|---|---|
| `appName` | `XNAPIFY_APP_NAME` | `"xnapify"` |
| `loginUrl` | `XNAPIFY_APP_URL + /login` | `"https://app.example.com/login"` |
| `resetUrl` | `XNAPIFY_APP_URL + /auth/reset` | `"https://app.example.com/auth/reset"` |
| `supportUrl` | `XNAPIFY_APP_URL + /support` | `"https://app.example.com/support"` |
| `now` | `new Date().toISOString()` | `"2026-01-15T10:30:00.000Z"` |
| `year` | `new Date().getFullYear()` | `2026` |

#### Flow
1. Looks up `EmailTemplate` by slug (DB-managed template).
2. Falls back to `defaultPayload.subject / html` if no template found.
3. Passes `text_body` from DB template as plain-text fallback.
4. Merges `baseVars()` + caller `templateData` + `subject`.
5. Renders all fields through LiquidJS.

## 3. Hook API for Extensions

Extensions can send emails by emitting the `emails:send` hook:

```javascript
const hook = container.resolve('hook');

await hook('emails').emit('send', {
  slug: 'order-confirmation',          // DB template slug (optional)
  to: 'customer@example.com',          // required — valid email
  subject: 'Order Confirmed',          // fallback subject (string)
  html: '<p>Hi {{ name }}</p>',        // fallback HTML body (string)
  data: { name: 'John', orderId: 42 }, // template variables (object)
});
```

#### Validation Rules
| Field | Rule |
|---|---|
| `payload` | Must be a non-null object |
| `to` | Required, valid email format |
| `slug` | Optional, lowercase alphanumeric + hyphens (e.g. `order-confirmation`) |
| `subject` | Optional, must be string |
| `html` | Optional, must be string |
| `data` | Optional, must be plain object |
| content | Must have either `html` or `slug` |

## 4. Transactional Email Hooks

Built-in hooks registered in `boot()`:

| Hook | Event | Trigger |
|---|---|---|
| `auth` | `registered` | User self-registers |
| `auth` | `password_reset_requested` | User requests password reset |
| `admin:users` | `created` | Admin creates a user |
| `admin:users` | `password_reset` | Admin resets user password |
| `admin:users` | `status_updated` | Admin activates/deactivates user |
| `admin:users` | `deleted` | Admin deletes user |
| `profile` | `password_changed` | User changes own password |
| `profile` | `account_deleted` | User deletes own account |
| `files` | `shared` | File shared with another user |

## 5. API Routes & Controllers (`api/`)
- **Method & Path:** `GET /api/admin/emails/templates` — List all templates
- **Method & Path:** `POST /api/admin/emails/templates` — Create template
- **Method & Path:** `GET /api/admin/emails/templates/[id]` — Get template
- **Method & Path:** `PUT /api/admin/emails/templates/[id]` — Update template
- **Method & Path:** `DELETE /api/admin/emails/templates/[id]` — Delete template
- **Method & Path:** `POST /api/admin/emails/templates/[id]/duplicate` — Duplicate template
- **Method & Path:** `POST /api/admin/emails/templates/[id]/preview` — Preview saved template
- **Method & Path:** `POST /api/admin/emails/templates/preview` — Preview raw template

## 6. Frontend SSR Rendering (`views/`)
- **Admin View:** `/admin/emails/templates` — List with search and status filtering
- **Admin View:** `/admin/emails/templates/create` — Create new template
- **Admin View:** `/admin/emails/templates/[id]/edit` — Edit with TemplateEditor (CodeMirror + LiquidJS syntax)
- **State Management:** Redux slice in `views/(admin)/redux/slice.js`

## 7. File Structure
```
src/apps/emails/
├── api/
│   ├── index.js              # Lifecycle hooks (providers, boot)
│   ├── hooks.js              # Transactional email hook registrations
│   ├── hooks.test.js         # 29 tests
│   ├── services/
│   │   └── send.service.js   # createSendTemplatedEmail, baseVars, displayNameOf
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   └── database/
│       ├── migrations/
│       └── seeds/            # 9 default email templates
├── views/
│   └── (admin)/
│       ├── components/       # TemplateEditor, TemplateVariables
│       ├── redux/            # slice.js, thunks.js
│       └── templates/        # List, Create, Edit pages
├── utils/
│   ├── template.js           # extractVariables, createPlaceholderData
│   └── template.test.js      # 16 tests
├── SPEC.md
└── README.md
```

---
*Note: This spec reflects the CURRENT implementation of the email template engine.*
