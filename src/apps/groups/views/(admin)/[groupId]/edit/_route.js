/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import { requirePermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
const { addBreadcrumb } = features;

import EditGroup from './EditGroup';

export const middleware = requirePermission('groups:update');

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.edit', 'Edit'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.edit', 'Edit'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default function EditGroupPage({ context }) {
  const { groupId } = context.params;
  return <EditGroup groupId={groupId} context={context} />;
}

EditGroupPage.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      groupId: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
