/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import GitHubButton from './GitHubButton';

export default {
  init(registry) {
    registry.registerSlot('auth.oauth.buttons', GitHubButton, { order: 30 });
  },

  destroy(registry) {
    registry.unregisterSlot('auth.oauth.buttons', GitHubButton);
  },
};
