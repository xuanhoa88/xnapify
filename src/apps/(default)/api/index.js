/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Auto-load routes via require.context
const routesContext = import.meta.webpackContext('./routes', {
  recursive: true,
  regExp: /\.[cm]?[jt]s$/i
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  routes: () => routesContext,
  boot() {
    console.info('[Default] ✅ Initialized');
  }
};