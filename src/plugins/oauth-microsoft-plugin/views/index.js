/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import MicrosoftButton from './MicrosoftButton';

export default {
  init(registry) {
    registry.registerSlot('auth.oauth.buttons', MicrosoftButton, {
      order: 40,
    });
  },

  destroy(registry) {
    registry.unregisterSlot('auth.oauth.buttons', MicrosoftButton);
  },
};
