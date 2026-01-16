/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import user from './features/user';
import runtime from './features/runtime';
import intl from './features/intl';
import ui from './features/ui';

// Note: admin reducers are now dynamically injected by page modules
// via store.injectReducer() in their route init hooks

// Export as object for dynamic injection in configureStore
export default {
  user,
  runtime,
  intl,
  ui,
};
