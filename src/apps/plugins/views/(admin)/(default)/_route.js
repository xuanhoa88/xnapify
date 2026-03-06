/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '../../../../../shared/renderer/redux';
import { requirePermission } from '../../../../../shared/renderer/components/Rbac';
import reducer, { SLICE_NAME } from './redux';
import Plugins from './Plugins';

// Protect route with 'plugins:read' permission
export const middleware = requirePermission('plugins:read');

export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Register menu item for this route
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      item: {
        ns: i18n.t('admin:navigation.system', 'System'),
        path: '/admin/plugins',
        label: i18n.t('admin:navigation.plugins', 'Plugins'),
        icon: 'extension', // or 'puzzle-piece' if available, checking lucide icons
        permission: 'plugins:read',
        order: 20,
      },
    }),
  );
}

/**
 * Unregister menu item for this route
 */
export function unregister({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/plugins',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.plugins', 'Plugins'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.plugins', 'Plugins'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default Plugins;
