/**
 * Posts Module — View entry point
 *
 * Module-type extension that provides view routes via the views() hook.
 * Redux reducer injection is handled per-route in _route.js init().
 */

const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout)\.[cm]?[jt]sx?$/i,
);

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
   * Lifecycle: providers — bind DI services shared with other modules.
   */
  providers({ container }) {}, // eslint-disable-line no-unused-vars

  /**
   * Declarative translations — auto-registered by extension manager.
   */
  translations() {
    return translationsContext;
  },

  /**
   * Module-type hook: provides view routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['posts', viewsContext];
  },
};
