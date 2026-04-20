---
id: extension-development
title: Extension Developer Guideline
sidebar_position: 9
---

# Extension Developer Guideline

Extensions in **xnapify** enable you to augment core functionality, inject UI elements dynamically, and establish database migrations without modifying the underlying App module logic. Extensions can easily be toggled on/off at runtime.

This guide covers best practices and procedures for architecting a new extension.

---

## The Two Types of Extensions

1. **Plugin-type**: Extends existing modules via UI `Slots`, API `Hooks`, and `IPC`. (E.g. A feature adding analytical statistics to user profiles).
2. **Module-type**: Acts almost as an independent App domain, exposing its own routable layouts `views()`, isolated controllers, and APIs, while maintaining rapid uninstall capabilities.

---

## 1. Directory Setup

Extensions live strictly inside the `src/extensions/` directory and must contain a valid `package.json` manifest.

```text
src/extensions/my_extension/
├── package.json
├── api/
│   ├── index.js                  # Backend Entry Point
│   └── database/
│       ├── migrations/
│       └── seeds/
├── views/
│   ├── index.js                  # Frontend Entry Point
│   └── components/
├── validator/                    # Shared validation logic
└── translations/                 # i18n JSON locales
    └── en-US.json
```

**`package.json` boilerplate:**
```json
{
  "name": "@xnapify-extension/my_extension",
  "version": "1.0.0",
  "browser": "views/index.js",
  "main": "api/index.js",
  "description": "Short explanation of my extension."
}
```

---

## 2. Setting Up Backend Logic (`api/index.js`)

The Backend API index file registers Webpack Context loaders and binds logic to the Node server lifecycle. The extension relies on `boot` to start, and `shutdown` to rigorously de-allocate memory to prevent leaks. 

```javascript
/* src/extensions/my_extension/api/index.js */

// Pre-calculate Webpack contexts mapping your directories 
const migrationsContext = require.context('./database/migrations', false, /\.[cm]?[jt]s$/i);
const translationsContext = require.context('../translations', false, /\.json$/i);
const HANDLERS = Symbol('handlers');

export default {
  [HANDLERS]: {},
  
  translations: () => translationsContext,

  // Fire when Extension loads
  async boot({ container, registry }) {
    console.log('[Extension Booted]');

    const db = container.resolve('db');
    if (db) {
       // Setup database dynamically
       await db.connection.runMigrations([{ context: migrationsContext, prefix: __EXTENSION_ID__ }]);
    }

    const hook = container.resolve('hook');
    
    // Bind logic listening to the explicit App Module's events
    this[HANDLERS].onUserSignup = (user) => { /* logic */ }
    hook('users').on('created', this[HANDLERS].onUserSignup);
  },

  // MUST cleanly destroy memory states
  async shutdown({ container, registry }) {
      const hook = container.resolve('hook');
      
      // Critical cleanup or Application Hot-Module-Reloading will break!
      hook('users').off('created', this[HANDLERS].onUserSignup);
  }
}
```

---

## 3. Injecting React User Interfaces (`views/index.js`)

Frontend configuration is conceptually similar but executes on the Application DOM. Instead of exposing HTTP route-handlers, Extension Views frequently bind into exposed **Render Slots** provided safely by underlying Application layouts.

```javascript
/* src/extensions/my_extension/views/index.js */
import MySpecialComponent from './components/MySpecialComponent'

const translationsContext = require.context('../translations', false, /\.json$/i);

export default {
  translations: () => translationsContext,
  
  // Evaluated globally before route layouts render
  providers({ container }) {
      // Useful for injecting explicit Redux slices dynamically
      // container.register('component:MyWidget', MyWidgetComponent)
  },

  boot({ registry }) {
      // Insert "MySpecialComponent" wherever the App defines:
      // <ExtensionSlot name="user.profile.details" />
      registry.registerSlot('user.profile.details', MySpecialComponent, { order: 10 });
  },

  shutdown({ registry }) {
      // Clean Memory explicitly!
      registry.unregisterSlot('user.profile.details', MySpecialComponent);
  }
}
```

---

## 4. Understanding Identifiers (`__EXTENSION_ID__`)

Webpack statically injects a universal constant called `__EXTENSION_ID__` inside all extension scripts at compile-time. Its value is derived from the extension's **directory name** (e.g., `docs-module` for `src/extensions/docs-module/`), optionally overridden by the `id` field in the extension's database record.

It's conventionally used to safely prefix:
- Database Tables / Migrations (`table: ${__EXTENSION_ID__}_logs`)
- IPC Communication Channels (`registry.registerHook("ipc:${__EXTENSION_ID__}:compute")`)
- Translation Scopes (`t("extension:${__EXTENSION_ID__}:labels.submit")`)

---

## Best Practices

> [!WARNING]
> **Assume Ephemerality:** Since Extensions can be unmounted or shut down interactively from an Admin screen, logic bound within `boot` MUST inversely de-bind in `shutdown`. Leaving dangling React hooks or Database Event emitters actively crashes process pools!

> [!IMPORTANT]
> **Data Encapsulation:** If making standard Database entities inside `api/models`, ensure they are intrinsically tied to your functionality to avoid breaking core Domains upon Uninstallation script executions.

> [!CAUTION]
> **NEVER Mutate React DOM:** Attempting to manipulate Core DOM constructs through pure `document.querySelector` avoids the React V-DOM mapping resulting in rendering mismatches. Exclusively use the `.registerSlot` mechanics.
