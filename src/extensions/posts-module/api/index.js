/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Posts Module — API entry point
 *
 * Module-type extension that provides API routes via the routes() hook.
 * Routes are dynamically injected into the API router at extension load time.
 */

// Auto-load contexts
const routesContext = import.meta.webpackContext('./routes', {
  recursive: true,
  regExp: /\.[cm]?[jt]s$/i,
});
const migrationsContext = import.meta.webpackContext('./database/migrations', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const seedsContext = import.meta.webpackContext('./database/seeds', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const modelsContext = import.meta.webpackContext('./models', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const translationsContext = import.meta.webpackContext('../translations', {
  recursive: false,
  regExp: /\.json$/i,
});

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
  async providers() {},

  /**
   * Lifecycle: boot — called on every load after models/migrations/seeds.
   */
  async boot() {},

  /**
   * Lifecycle: shutdown — teardown on extension unload.
   */
  async shutdown() {},

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
