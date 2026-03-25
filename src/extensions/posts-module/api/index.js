/**
 * Posts Module — API entry point
 *
 * Module-type extension that provides API routes via the routes() hook.
 * Routes are dynamically injected into the API router at extension load time.
 */

// Auto-load contexts
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

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================
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
  async install() {},

  /**
   * Lifecycle: init (called on every load)
   */
  async boot() {},

  /**
   * Lifecycle: destroy
   */
  async shutdown() {},

  /**
   * Lifecycle: uninstall
   * Reverts seeds and database migrations.
   */
  async uninstall({ container }) {
    const db = container.resolve('db');
    if (db) {
      await db.connection.revertSeeds(
        [{ context: seedsContext, prefix: __EXTENSION_NAME__ }],
        { container },
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
