/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import UserApiKeys from './UserApiKeys';
import { addBreadcrumb } from '../../../../../../../shared/renderer/redux';
import { requirePermission } from '../../../../../../../shared/renderer/components/Rbac';

export const middleware = requirePermission('api_keys:read');

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.apiKeys', 'API Keys'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('navigation.apiKeys', 'API Keys'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default function UserApiKeysPage({ context: { params } }) {
  const { userId } = params;
  return <UserApiKeys userId={userId} />;
}

UserApiKeysPage.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      userId: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
