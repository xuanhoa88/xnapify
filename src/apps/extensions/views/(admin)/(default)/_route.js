/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';
import { useWebSocket } from '@shared/ws/client/index.js';

import Extensions from './Extensions.js';
import reducer, { SLICE_NAME } from './redux/index.js';

const { addBreadcrumb, registerMenu, unregisterMenu } = features;

export const middleware = requirePermission('extensions:read');

/**
 * Route boot — inject Redux reducer into the store.
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Register menu item for this route
 */
export function setup({ store, i18n }) {
  const registerHubMenu = (badgeCount = 0) => {
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
}

/**
 * Unregister menu item for this route
 */
export function teardown({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/extensions',
    }),
  );
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/extensions/hub',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.extensions', 'Extensions'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path, fetch }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.extensions', 'Extensions'),
        url: path,
      },
      'admin',
    ),
  );

  // Register initially without badge
  registerHubMenu(0);

  // Client-side only
  if (typeof window !== 'undefined') {
    // 1. Fetch initial badge count
    fetch('/api/admin/extensions/hub/updates/count')
      .then(res => {
        const count = (res.data && res.data.count) || 0;
        if (count > 0) registerHubMenu(count);
      })
      .catch(() => { }); // Ignore network errors

    // 2. Subscribe to WebSocket updates
    // Use a slight timeout to ensure WS client is initialized
    setTimeout(() => {
      const ws = useWebSocket();
      if (ws) {
        // Assume 'admin' channel is subscribed globally by the layout
        ws.on('extension:updates_available', data => {
          if (data && data.type === 'UPDATES_AVAILABLE_COUNT') {
            registerHubMenu(data.count || 0);
          }
        });
      }
    }, 2000);
  }
}

/**
 * Default export - Page component
 */
export default Extensions;
