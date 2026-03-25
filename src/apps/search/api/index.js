/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerSearchHooks } from './hooks';

// Auto-load routes via require.context
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  async boot({ container }) {
    registerSearchHooks(container);
    console.info('[Search] ✅ Initialized');
  },

  routes: () => routesContext,
};
