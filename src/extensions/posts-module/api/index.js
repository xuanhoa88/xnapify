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
   * Declarative hooks — auto-processed by ServerExtensionManager.
   */
  models: () => modelsContext,
  migrations: () => migrationsContext,
  seeds: () => seedsContext,
  translations: () => translationsContext,

  /**
   * Lifecycle: install (one-time setup — currently a no-op)
   */
  async install(_registry, _context) {},

  /**
   * Lifecycle: init (called on every load)
   */
  async boot(_registry, _context) {},

  /**
   * Lifecycle: destroy
   */
  async shutdown(_registry, _context) {},

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
   * Module-type hook: provides API routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['posts', routesContext];
  },
};
