/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { reducers } from './features';

// Note: admin reducers are dynamically injected by page modules
// via store.injectReducer() in their views/index.js providers() hook

// Export as object for dynamic injection in configureStore
export default {
  ...reducers,
};
