/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux/index.js';

const { registerMenu } = features;

/**
 * Build the Extensions section of the admin sidebar.
 *
 * Lives outside the route module because the module lifecycle registers the
 * menu at boot, while the Manage page re-registers it with a badge once it
 * knows how many updates are pending. Both need the same entry shape, and
 * `registerMenu` replaces the section by id, so calling it again only
 * updates the badge.
 *
 * @param {Object} store - Redux store
 * @param {Object} i18n - i18next instance for the current request or session
 * @returns {(badgeCount?: number) => void} Registers the section
 */
export const createRegisterHubMenu =
  (store, i18n) =>
  (badgeCount = 0) => {
    store.dispatch(
      registerMenu({
        ns: 'admin',
        id: 'extensions',
        label: i18n.t('admin:navigation.extensionsGroup', 'Extensions'),
        order: 90,
        items: [
          {
            path: '/admin/extensions/hub',
            label: i18n.t('admin:navigation.hub', 'Hub'),
            icon: 'GlobeIcon',
            permission: 'extensions:read',
            order: 10,
            badge: badgeCount > 0 ? badgeCount : undefined,
          },
          {
            path: '/admin/extensions',
            label: i18n.t('admin:navigation.extensions', 'Manage'),
            icon: 'CubeIcon',
            permission: 'extensions:read',
            order: 20,
            exact: true,
          },
        ],
      }),
    );
  };

export default createRegisterHubMenu;
