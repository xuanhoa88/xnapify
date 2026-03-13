# Emails Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand the email template management logic inside `src/apps/emails`.
> This module allows administrators to design, preview, and manage system email templates using LiquidJS.

---

## Objective
Provide a robust system for managing transactional email templates with real-time preview and dynamic content injection.

## 1. Database Modifications (`api/models`)
- **Model:** `EmailTemplate`
- **Columns:**
  - `id`: UUID (Primary Key)
  - `name`: String (Human readable name)
  - `subject`: String (Email subject line, supports LiquidJS)
  - `body`: Text (Email content, supports LiquidJS/HTML)
  - `status`: Enum (`active`, `draft`)
  - `key`: String (Unique key for system identification, e.g. `WELCOME_EMAIL`)

## 2. API Routes & Controllers (`api/`)
- **Method & Path:** `GET /api/emails/templates`
  - **Security:** Requires `emails:read` permission.
  - **Logic:** Returns a list of all email templates.
- **Method & Path:** `POST /api/emails/templates`
  - **Security:** Requires `emails:manage` permission.
  - **Logic:** Creates a new template.
- **Method & Path:** `GET /api/emails/templates/[id]`
  - **Logic:** Fetches a specific template by UUID.
- **Method & Path:** `PATCH /api/emails/templates/[id]`
  - **Logic:** Updates template body, subject, or status.
- **Method & Path:** `POST /api/emails/templates/[id]/duplicate`
  - **Logic:** Clones an existing template into a new one.
- **Method & Path:** `POST /api/emails/templates/preview`
  - **Logic:** Renders LiquidJS content on-the-fly for previewing unsaved changes.
- **Method & Path:** `GET /api/emails/templates/[id]/preview`
  - **Logic:** Renders a saved template with optional test data.

## 3. Frontend SSR Rendering (`views/`)
- **Admin View:** `/admin/emails/templates`
  - **Component:** `EmailTemplates.js`.
  - **Logic:** List of templates with search and status filtering.
- **Admin View:** `/admin/emails/templates/create`
  - **Component:** `CreateEmailTemplate.js`.
- **Admin View:** `/admin/emails/templates/[id]/edit`
  - **Component:** `EditEmailTemplate.js`.
  - **Editor:** Uses `TemplateEditor.js` (CodeMirror/Monaco integration for LiquidJS syntax).
- **State Management:** Uses Redux slice in `views/(admin)/redux/slice.js` to manage template state and asynchronous CRUD operations.

## 4. Localization (`translations/`)
- **Keys:** `emails.templates.title`, `emails.editor.subject_label`, `emails.preview.empty_state`.
- **Rule:** Template names and subjects should be translated where applicable if they are user-facing via system notifications.

---
*Note: This spec reflects the CURRENT implementation of the email template engine.*
