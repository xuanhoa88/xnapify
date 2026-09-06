/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Admin Route
 */

import { requirePermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';

import ActivityList from './ActivityList.js';

const { addBreadcrumb } = features;

export const middleware = requirePermission('activities:read');

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.activities', 'Activity Logs'),
  };
}

/**
 * Mount breadcrumb
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.activities', 'Activity Logs'),
        url: path,
      },
      'admin',
    ),
  );
}

export default ActivityList;
