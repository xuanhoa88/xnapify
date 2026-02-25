/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Init hook — called by the autoloader to initialise this module.
 *
 * @param {Object} _app - Express app instance
 * @param {Object} _options - Options ({ CORE_MODULES })
 */
export async function init(_app, _options) {
  console.info('[Auth] ✅ Initialized');
}
