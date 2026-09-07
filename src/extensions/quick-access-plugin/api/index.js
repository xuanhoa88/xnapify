/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Quick Access Plugin — API entry point
 *
 * Plugin-kind extension that seeds demo user accounts for the
 * quick-access login widget.
 */

// Auto-load contexts
const seedsContext = import.meta.webpackContext('./database/seeds', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================
export default {
  /**
   * Declarative hooks — auto-processed by ServerExtensionManager.
   */
  seeds: () => seedsContext,
};
