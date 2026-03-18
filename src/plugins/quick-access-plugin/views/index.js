/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import QuickAccess from './QuickAccess';

export default {
  init(registry) {
    registry.registerSlot('auth.login.quickAccess', QuickAccess, { order: 10 });
  },

  destroy(registry) {
    registry.unregisterSlot('auth.login.quickAccess', QuickAccess);
  },
};
