/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';
import { getWebSocketClient } from '@shared/ws/client/index.js';

import { createRegisterHubMenu } from '../../menu.js';

import Extensions from './Extensions.js';
import reducer, { SLICE_NAME } from './redux/index.js';

const { addBreadcrumb } = features;

export const middleware = requirePermission('extensions:read');

/**
 * Route boot — inject Redux reducer into the store.
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
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

  const registerHubMenu = createRegisterHubMenu(store, i18n);

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
      .catch(() => {}); // Ignore network errors

    // 2. Subscribe to WebSocket updates
    // Use a slight timeout to ensure WS client is initialized
    setTimeout(() => {
      const ws = getWebSocketClient();
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
