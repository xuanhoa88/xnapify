/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';

import {
  DotsVerticalIcon,
  LockOpen1Icon,
  GroupIcon,
  IdCardIcon,
  TokensIcon,
  PersonIcon,
  Cross2Icon,
  CheckIcon,
} from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu/index.js';
import { useHistory } from '@shared/renderer/components/History/index.js';
import { features } from '@shared/renderer/redux/index.js';

const { getUserId } = features;

/**
 * UserActionsDropdown - Dropdown menu for user actions
 */
function UserActionsDropdown({
  user,
  onManageRoles,
  onManageGroups,
  onViewPermissions,
  onActivate,
  onDeactivate,
  onImpersonate,
}) {
  const { t } = useTranslation();
  const currentUserId = useSelector(getUserId);
  const history = useHistory();

  const isCurrentUser = useMemo(
    () => currentUserId === user.id,
    [currentUserId, user.id],
  );

  return (
    <ContextMenu>
      <ContextMenu.Trigger
        title={t('users:admin.list.moreActions', 'More actions')}
        className='rt-IconButton'
      >
        <DotsVerticalIcon width={16} height={16} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => history.push(`/admin/users/${user.id}/api-keys`)}
          icon={<TokensIcon width={16} height={16} />}
          permission='apiKeys:read'
        >
          {t('users:admin.list.manageApiKeys', 'Manage API Keys')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageGroups(user)}
          icon={<GroupIcon width={16} height={16} />}
          permission='groups:*'
        >
          {t('users:admin.list.manageGroups', 'Manage Groups')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageRoles(user)}
          icon={<IdCardIcon width={16} height={16} />}
          permission='roles:*'
        >
          {t('users:admin.list.manageRoles', 'Manage Roles')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onViewPermissions(user)}
          icon={<LockOpen1Icon width={16} height={16} />}
          permission='permissions:read'
        >
          {t('users:admin.list.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        {!isCurrentUser && (
          <ContextMenu.Item
            onClick={() => onImpersonate(user)}
            icon={<PersonIcon width={16} height={16} />}
            permission='users:impersonate'
          >
            {t('users:admin.list.impersonate', 'Impersonate')}
          </ContextMenu.Item>
        )}
        {!isCurrentUser && (
          <>
            <ContextMenu.Divider />
            {user.is_active ? (
              <ContextMenu.Item
                onClick={() => onDeactivate(user)}
                icon={<Cross2Icon width={16} height={16} />}
                variant='danger'
                permission={['users:update', 'users:delete']}
              >
                {t('users:admin.list.deactivate', 'Deactivate')}
              </ContextMenu.Item>
            ) : (
              <ContextMenu.Item
                onClick={() => onActivate(user)}
                icon={<CheckIcon width={16} height={16} />}
                permission={['users:update', 'users:delete']}
              >
                {t('users:admin.list.activate', 'Activate')}
              </ContextMenu.Item>
            )}
          </>
        )}
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

UserActionsDropdown.propTypes = {
  user: PropTypes.object.isRequired,
  onManageRoles: PropTypes.func.isRequired,
  onManageGroups: PropTypes.func.isRequired,
  onViewPermissions: PropTypes.func.isRequired,
  onActivate: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  onImpersonate: PropTypes.func.isRequired,
};

export default UserActionsDropdown;
