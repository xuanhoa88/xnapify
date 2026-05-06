/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
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
   * Declarative translations — auto-registered by extension manager.
   */
  translations() {
    return translationsContext;
  },
  /**
   * Lifecycle: providers — bind DI services if needed.
   */
  providers() {},

  /**
   * Lifecycle: boot — register slots, hooks, IPC handlers.
   */
  boot() {},

  /**
   * Lifecycle: shutdown — MUST exactly inverse boot().
   */
  shutdown() {},

  /**
   * Module-type hook: provides view routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['docs', viewsContext];
  },
};
