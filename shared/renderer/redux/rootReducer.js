/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import intl from './features/intl';
import runtime from './features/runtime';
import ui from './features/ui';
import user from './features/user';

// Note: admin reducers are dynamically injected by page modules
// via store.injectReducer() in their _route.js init() hook

// Export as object for dynamic injection in configureStore
export default {
  user,
  runtime,
  intl,
  ui,
};
