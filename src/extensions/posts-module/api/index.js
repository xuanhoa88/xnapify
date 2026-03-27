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
   * Lifecycle: providers — bind DI services shared with other modules.
   */
  async providers({ container }) {}, // eslint-disable-line no-unused-vars

  /**
   * Lifecycle: boot — called on every load after models/migrations/seeds.
   */
  async boot({ container }) {}, // eslint-disable-line no-unused-vars

  /**
   * Lifecycle: shutdown — teardown on extension unload.
   */
  async shutdown({ container }) {}, // eslint-disable-line no-unused-vars

  /**
   * Lifecycle: uninstall — custom teardown (if any).
   * Seeds and migrations are auto-reverted by the framework using
   * the declarative migrations() and seeds() contexts above.
   */
  async uninstall() {},

  /**
   * Module-type hook: provides API routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['posts', routesContext];
  },
};
