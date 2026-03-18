# Template Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Template Engine at `shared/api/engines/template`.

---

## Objective

Provide LiquidJS template rendering as a shared service for dynamic content generation.

## 1. Architecture

```
shared/api/engines/template/
├── index.js      # Default singleton
└── factory.js    # TemplateManager class + createFactory()
```

## 2. TemplateManager (`factory.js`)

- Wraps a `Liquid` instance from the `liquidjs` package.
- `render(templateString, data)` — renders template, catches errors, returns empty string on failure.
- `renderStrict(templateString, data)` — renders template, throws on error (for preview/validation).

## 3. Default Singleton

`index.js` exports `createFactory()`. Registered on DI as `app.get('template')`.

## 4. Dependencies

- Used by the Email Engine for `templateData` rendering in subject/body.
- Used by the Emails module for managed email template rendering.

---

*Note: This spec reflects the CURRENT implementation of the template engine.*
