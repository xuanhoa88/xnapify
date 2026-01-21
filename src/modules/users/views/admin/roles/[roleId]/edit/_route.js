/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import EditRole from './EditRole';
import { addBreadcrumb } from '../../../../../../../shared/renderer/redux';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.edit', 'Edit'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('navigation.edit', 'Edit'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default function EditRolePage({ context: { params } }) {
  const { roleId } = params;
  return <EditRole roleId={roleId} />;
}

EditRolePage.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      roleId: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
