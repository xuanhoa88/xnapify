/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Posts Module — View entry point
 *
 * Module-type extension that provides view routes via the views() hook.
 * Redux reducer injection is handled per-route in _route.js init().
 */

const viewsContext = import.meta.webpackContext('.', {
  recursive: true,
  regExp: /(?:\/_route|\/_layout)\.[cm]?[jt]sx?$/i,
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
   * Lifecycle: providers — bind DI services shared with other modules.
   */
  providers() {},

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
