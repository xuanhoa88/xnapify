/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import EditGroup from './EditGroup';
import { addBreadcrumb } from '../../../../../../../shared/renderer/redux';

/**
 * Page metadata
 */
export const metadata = ({ i18n }) => ({
  title: i18n.t('navigation.edit', 'Edit'),
});

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
export default function EditGroupPage({ context: { params } }) {
  const { groupId } = params;
  return <EditGroup groupId={groupId} />;
}

EditGroupPage.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      groupId: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
