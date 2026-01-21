/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import CreateUser from './CreateUser';
import { addBreadcrumb } from '../../../../../../shared/renderer/redux';

/**
 * Page metadata
 */
export const metadata = ({ i18n }) => ({
  title: i18n.t('navigation.create', 'Create'),
});

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('navigation.create', 'Create'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default CreateUser;
