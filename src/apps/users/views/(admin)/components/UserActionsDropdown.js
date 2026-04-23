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
  ArchiveIcon,
  LockClosedIcon,
  PersonIcon,
  Cross2Icon,
  CheckIcon,
} from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import { useHistory } from '@shared/renderer/components/History';
import { features } from '@shared/renderer/redux';

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
        title={t('admin:users.list.moreActions', 'More actions')}
        className='rt-IconButton'
      >
        <DotsVerticalIcon width={16} height={16} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => history.push(`/admin/users/${user.id}/api-keys`)}
          icon={<LockOpen1Icon width={16} height={16} />}
          permission='apiKeys:read'
        >
          {t('admin:users.list.manageApiKeys', 'Manage API Keys')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageGroups(user)}
          icon={<ArchiveIcon width={16} height={16} />}
          permission='groups:*'
        >
          {t('admin:users.list.manageGroups', 'Manage Groups')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageRoles(user)}
          icon={<LockClosedIcon width={16} height={16} />}
          permission='roles:*'
        >
          {t('admin:users.list.manageRoles', 'Manage Roles')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onViewPermissions(user)}
          icon={<LockClosedIcon width={16} height={16} />}
          permission='permissions:read'
        >
          {t('admin:users.list.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        {!isCurrentUser && (
          <ContextMenu.Item
            onClick={() => onImpersonate(user)}
            icon={<PersonIcon width={16} height={16} />}
            permission='users:impersonate'
          >
            {t('admin:users.list.impersonate', 'Impersonate')}
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
                {t('admin:users.list.deactivate', 'Deactivate')}
              </ContextMenu.Item>
            ) : (
              <ContextMenu.Item
                onClick={() => onActivate(user)}
                icon={<CheckIcon width={16} height={16} />}
                permission={['users:update', 'users:delete']}
              >
                {t('admin:users.list.activate', 'Activate')}
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
