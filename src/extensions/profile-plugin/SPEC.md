# Profile Plugin Extension Specification

> **Instructions for the AI:**
> Read this document to understand the features built inside `src/extensions/profile-plugin`.
> This is the **reference extension** — it demonstrates the canonical patterns for extending xnapify via slots, hooks, IPC, and the registry.
> Read `.agent/rules.md` and `AGENT.md` to understand HOW to build extensions securely.

---

## Objective

Extend the user profile page with additional fields (nickname, mobile, birthdate) using the extension slot and hook system. This plugin serves as a working reference implementation for all extension patterns: schema hooks, slot injection, IPC pipelines, and proper lifecycle cleanup.

## 1. Database & Hooks (`api/`)

### Backend Hook Subscriptions (registered in `boot()`)

| Hook | Event | Handler | Purpose |
|------|-------|---------|---------|
| `profile` | `validation:update` | `updateValidation` | Extends the profile Zod schema with `nickname`, `mobile`, `birthdate` fields |
| `profile` | `updating` | `updating` | Logs persisted EAV row data (nickname is auto-persisted as native EAV) |
| `profile` | `retrieved` | `formatResponse` | Reads nickname/birthdate/mobile from EAV and injects into API response |

### Shutdown Cleanup

All hook listeners are stored on `this[HANDLERS]` and explicitly unsubscribed in `shutdown()` via `hook('profile').off(...)`. This prevents memory leaks during hot-reload and extension deactivation.

### Database Migrations & Seeds

- **Migrations:** `api/database/migrations/` — run on extension install via `db.connection.runMigrations()`
- **Seeds:** `api/database/seeds/` — run on extension install via `db.connection.runSeeds()`
- Both are reverted on `uninstall()` in reverse order (seeds first, then migrations)

## 2. IPC Handlers (`api/`)

IPC handlers are registered on the `registry` in `boot()` and accessible via `POST /api/extensions/:id/ipc`.

> **Identity note:** IPC hook IDs and URLs use `__EXTENSION_ID__` (`snakeCase(manifest.name)`), which is URL-safe.

| Action | Hook ID | Purpose |
|--------|----------|---------|
| `hello` | ``ipc:${__EXTENSION_ID__}:hello`` | Returns greeting with extension name and timestamp |
| `checkNickname` | ``ipc:${__EXTENSION_ID__}:checkNickname`` | Checks if a nickname is already taken via `UserProfile.findOne()` |

**Middleware pipeline pattern:** IPC handlers use `registry.createPipeline(mw1, mw2, handler)` — a composable middleware chain where each function calls `next()` to proceed.

## 3. Frontend Components & Slots (`views/`)

### Slot Registrations (registered in `boot()`)

| Slot Name | Component | Order | Purpose |
|-----------|-----------|-------|---------|
| `profile.personal_info.fields` | `ExtensionField` | 10 | Renders nickname, mobile, and birthdate input fields |

### Hook Registrations (registered in `boot()`)

| Hook Name | Handler | Purpose |
|-----------|---------|---------|
| `profile.personal_info.validator` | `extendProfileValidator` | Extends the profile form Zod schema with extension fields |
| `profile.personal_info.submit` | Pipeline (logging + nickname guard + handler) | Runs on profile form submission |
| `profile.personal_info.formData` | `handleProfileDefaults` | Provides default values for the extension fields |

### Shutdown Cleanup

All slots and hooks are explicitly unregistered in `shutdown()` via `registry.unregisterSlot()` and `registry.unregisterHook()`. The `[HANDLERS]` map is cleared to release references.

## 4. Validation (`validator/`)

- **`profileSchema(z)`**: Defines a Zod schema extending the profile object with:
  - `nickname`: `z.string()` (optional)
  - `mobile`: `z.string()` (optional)
  - `birthdate`: `z.string()` (optional, date format)

## 5. Localization (`translations/`)
- **Locales:** `en-US.json`, `vi-VN.json`
- **Keys:** Extension-specific labels for the nickname, mobile, and birthdate fields.
- **Registration:** The `translations()` lifecycle hook returns a Webpack context for auto-registration into the global i18next instance.

## 6. File Structure

```
src/extensions/profile-plugin/
├── api/
│   ├── index.js              # Backend lifecycle (install, boot, shutdown, uninstall)
│   └── database/
│       ├── migrations/       # Schema changes
│       └── seeds/            # Initial data
├── views/
│   ├── index.js              # Frontend lifecycle (boot, shutdown)
│   └── ExtensionField.js     # Slot component (nickname/mobile/birthdate inputs)
├── validator/
│   └── index.js              # profileSchema(z) for Zod validation
├── translations/
│   ├── en-US.json
│   └── vi-VN.json
├── package.json              # Extension manifest
└── SPEC.md                   # This file
```

---
*Note: This spec reflects the CURRENT implementation of the reference profile-plugin extension.*
