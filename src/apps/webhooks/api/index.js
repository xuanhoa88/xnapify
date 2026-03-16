/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhook Module Entry Point
 *
 * The `webhook` singleton is auto-injected onto `app` by the
 * bootstrap's `registerEngines()` in `src/bootstrap/api/index.js`.
 *
 * ## What This Module Does
 *
 * 1. **routes()** — Exposes admin and inbound webhook routes
 */

// Auto-load routes via require.context
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Routes hook — returns the webpack require.context for this module's routes.
 *
 * @returns {Object} Webpack require.context for routes
 */
export function routes() {
  return routesContext;
}
