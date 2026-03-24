/**
 * Posts Module — API entry point
 *
 * Module-type extension that provides API routes via the routes() hook.
 * Routes are dynamically injected into the API router at extension load time.
 */

const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);

const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

export default {
  /**
   * Lifecycle: install
   * Runs database migrations and seeds permissions.
   */
  async install(_registry, context) {
    const db = context.container.resolve('db');
    if (db) {
      await db.connection.runMigrations([
        { context: migrationsContext, prefix: __EXTENSION_NAME__ },
      ]);

      await db.connection.runSeeds(
        [{ context: seedsContext, prefix: __EXTENSION_NAME__ }],
        { container: context.container },
      );
    }
  },

  /**
   * Lifecycle: init
   * Registers models with the global models map.
   */
  async init(_registry, context) {
    const db = context.container.resolve('db');
    const models = context.container.resolve('models');

    if (db) {
      // Run migrations (idempotent — skips already-applied)
      await db.connection.runMigrations([
        { context: migrationsContext, prefix: __EXTENSION_NAME__ },
      ]);

      if (models) {
        for (const key of modelsContext.keys()) {
          const mod = modelsContext(key);
          const factory = mod.default || mod;
          if (typeof factory === 'function') {
            const model = factory(db);
            if (model && model.name) {
              models[model.name] = model;
            }
          }
        }
      }
    }
  },

  /**
   * Lifecycle: destroy
   */
  async destroy(_registry, _context) {
    // no-op
  },

  /**
   * Lifecycle: uninstall
   * Reverts seeds and database migrations.
   */
  async uninstall(_registry, context) {
    const db = context.container.resolve('db');
    if (db) {
      await db.connection.revertSeeds(
        [{ context: seedsContext, prefix: __EXTENSION_NAME__ }],
        { container: context.container },
      );

      await db.connection.revertMigrations([
        { context: migrationsContext, prefix: __EXTENSION_NAME__ },
      ]);
    }
  },

  /**
   * Declarative translations — auto-registered by extension manager.
   */
  translations() {
    return translationsContext;
  },

  /**
   * Module-type hook: provides API routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['posts', routesContext];
  },
};
