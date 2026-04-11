/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
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
   * Declarative translations — auto-registered by extension manager.
   */
  translations() {
    return translationsContext;
  },

  /**
   * Lifecycle: providers — bind DI services if needed.
   */
  providers({ container }) {}, // eslint-disable-line no-unused-vars

  /**
   * Lifecycle: boot — register slots, hooks, IPC handlers.
   */
  boot({ registry }) {}, // eslint-disable-line no-unused-vars

  /**
   * Lifecycle: shutdown — MUST exactly inverse boot().
   */
  shutdown({ registry }) {}, // eslint-disable-line no-unused-vars

  /**
   * Module-type hook: provides view routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['guides', viewsContext];
  },
};
