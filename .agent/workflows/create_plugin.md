---
description: Create a new system plugin
---

When the user requests to create a new plugin to extend the system without modifying core code, follow this exact workflow to ensure it perfectly integrates with the rapid-rsk Plugin Manager registry.

### 1. Structure Initialization

Create a new directory for the plugin in `src/plugins/[plugin-name]/`.
Plugins are isolated sets of features and generally contain two main components:
- `api/` for backend logic (hooks, IPC routes, migrations)
- `views/` for frontend logic (UI slots, validation extensions)
- `translations/` for declarative i18n JSON files

### 2. Backend Plugin Setup (`src/plugins/[plugin-name]/api/`)

The backend requires an `index.js` file exporting a plugin configuration object.

**Create `src/plugins/[plugin-name]/api/index.js`**:
```javascript
// Private symbol for handlers storage (needed for cleanup in 'destroy')
const HANDLERS = Symbol('handlers');

// Auto-load translations (Optional)
const translationsContext = require.context('../translations', false, /\.json$/i);

// Auto-load migrations and seeds (Optional)
const migrationsContext = require.context('./database/migrations', false, /\.[cm]?[jt]s$/i);
const seedsContext = require.context('./database/seeds', false, /\.[cm]?[jt]s$/i);

export default {
  // Store handlers for cleanup
  [HANDLERS]: {},

  // Declarative translations — auto-registered by plugin manager
  translations() {
    return translationsContext;
  },

  // Lifecycle: install (called once when the user installs the plugin)
  async install(registry, context) {
    const db = context.app.get('db');
    // Run plugin initial migrations and seeds
    await db.connection.runMigrations([{ context: migrationsContext, prefix: __PLUGIN_NAME__ }]);
    await db.connection.runSeeds([{ context: seedsContext, prefix: __PLUGIN_NAME__ }]);
  },

  // Lifecycle: init (called when plugin is initialized on the server)
  async init(registry, context) {
    const hook = context.app.get('hook');

    // 1. Listen to core backend hooks
    this[HANDLERS].onUpdate = function(data) { ... };
    hook('some-domain').on('action', this[HANDLERS].onUpdate);

    // 2. Register IPC Handlers (accessible via POST /api/plugins/:id/ipc)
    this[HANDLERS].ipcAction = registry.createPipeline(
      async (data, { req }) => { return { result: 'success' }; }
    );
    registry.registerHook(`ipc:${__PLUGIN_NAME__}:my-action`, this[HANDLERS].ipcAction, __PLUGIN_NAME__);
  },

  // Lifecycle: uninstall (called once when the user deletes the plugin)
  async uninstall(registry, context) {
    const db = context.app.get('db');
    // Revert migrations and seeds
    await db.connection.undoSeeds([{ context: seedsContext, prefix: __PLUGIN_NAME__ }]);
    await db.connection.revertMigrations([{ context: migrationsContext, prefix: __PLUGIN_NAME__ }]);
  },

  // Lifecycle: destroy (called when plugin is disabled)
  async destroy(registry, context) {
    const hook = context.app.get('hook');
    // Unsubscribe from core hooks
    hook('some-domain').off('action', this[HANDLERS].onUpdate);
    // Cleanup reference
    this[HANDLERS] = {};
  }
};
```

### 3. Frontend Plugin Setup (`src/plugins/[plugin-name]/views/`)

The frontend requires an `index.js` file exporting a client plugin object.

**Create `src/plugins/[plugin-name]/views/index.js`**:
```javascript
import PluginComponent from './PluginComponent';

const HANDLERS = Symbol('handlers');
const translationsContext = require.context('../translations', false, /\.json$/i);

export default {
  [HANDLERS]: {},

  translations() {
    return translationsContext;
  },

  // Lifecycle: init (called when plugin is initialized in browser)
  init(registry, context) {
    // 1. Register UI Slots
    registry.registerSlot('some.extension.point', PluginComponent, { order: 10 });

    // 2. Register Data/Logic Hooks (Validation, Defaults, Pipelines)
    // Compose a pipeline handler for form submissions, etc.
    this[HANDLERS].onSubmit = registry.createPipeline(
      async data => { console.log('Plugin processing data', data); }
    );
    registry.registerHook('some.form.submit', this[HANDLERS].onSubmit);
  },

  // Lifecycle: destroy (called when plugin is disabled)
  destroy(registry) {
    // 1. Unregister UI Slots
    registry.unregisterSlot('some.extension.point', PluginComponent);

    // 2. Unregister Hooks
    registry.unregisterHook('some.form.submit', this[HANDLERS].onSubmit);

    this[HANDLERS] = {};
  }
};
```

### Key Differences from App Modules
- **Plugins** use `install`/`uninstall` hooks for DDL changes, whereas core modules run migrations on every boot via `migrations`/`seeds` boot hooks.
- **Plugins** extend functionality purely via `registry.registerSlot`, `registry.registerHook`, and `app.get('hook')` events, never directly modifying code.
- Always use `this[HANDLERS]` and a `Symbol` to store function references, so that `.off()` or `unregisterHook()` can successfully clean them up in the `destroy` phase.
