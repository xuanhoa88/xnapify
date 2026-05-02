/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const routesContext = require.context(
  './routes',
  true,
  /_route\.[cm]?[jt]sx?$/i,
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
   * Lifecycle: boot — called on every server boot.
   */
  async boot({ container, registry }) {}, // eslint-disable-line no-unused-vars

  /**
   * Lifecycle: shutdown — teardown on extension unload.
   */
  async shutdown({ container, registry }) {}, // eslint-disable-line no-unused-vars

  /**
   * Lifecycle: uninstall — custom teardown (if any).
   */
  async uninstall() {},

  /**
   * Module-type hook: provides API routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  routes() {
    return ['docs', routesContext];
  },
};
