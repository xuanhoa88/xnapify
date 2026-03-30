/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import GitHubButton from './GitHubButton';

export default {
  boot({ registry }) {
    registry.registerSlot('auth.oauth.buttons', GitHubButton, { order: 30 });
  },

  shutdown({ registry }) {
    registry.unregisterSlot('auth.oauth.buttons', GitHubButton);
  },
};
