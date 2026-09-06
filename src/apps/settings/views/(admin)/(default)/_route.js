/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';

import reducer, { SLICE_NAME } from '../redux/index.js';

import SettingsPage from './SettingsPage.js';

/** Stable extension namespace (see manifest `slots`). */
export const namespace = 'admin.settings';

const { addBreadcrumb } = features;

/**
 * Route boot — inject Redux reducer into the store.
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

export const middleware = requirePermission('settings:read');

/**
 * Page metadata
 */

export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.settings', 'Settings'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.settings', 'Settings'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default SettingsPage;
