/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import FacebookButton from './FacebookButton';

export default {
  init(registry) {
    registry.registerSlot('auth.oauth.buttons', FacebookButton, { order: 20 });
  },

  destroy(registry) {
    registry.unregisterSlot('auth.oauth.buttons', FacebookButton);
  },
};
