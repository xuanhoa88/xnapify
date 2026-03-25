/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import GoogleButton from './GoogleButton';

export default {
  boot(registry) {
    registry.registerSlot('auth.oauth.buttons', GoogleButton, { order: 10 });
  },

  shutdown(registry) {
    registry.unregisterSlot('auth.oauth.buttons', GoogleButton);
  },
};
