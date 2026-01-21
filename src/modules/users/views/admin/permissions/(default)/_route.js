/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { SLICE_NAME } from '../redux';
import Permissions from './Permissions';
import { addBreadcrumb } from '../../../../../../shared/renderer/redux';

/**
 * Page metadata
 */
export const metadata = ({ i18n }) => ({
  title: i18n.t('navigation.permissions', 'Permissions'),
  breadcrumb: {
    label: i18n.t('navigation.permissions', 'Permissions'),
    ns: 'admin',
  },
});

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('navigation.permissions', 'Permissions'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Boot function - inject Redux slice
 */
export function boot({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
}

/**
 * Default export - Page component
 */
export default Permissions;
