/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import { getUserId } from '@shared/renderer/redux';

/**
 * UserActionsDropdown - Dropdown menu for user actions
 *
 * To ensure only one dropdown is open at a time, pass `isOpen` and `onToggle` from parent.
 * Parent should manage activeDropdownId state and pass `isOpen={activeDropdownId === user.id}`
 * and `onToggle={(id) => setActiveDropdownId(prev => prev === id ? null : id)}`
 */
function UserActionsDropdown({
  user,
  isOpen,
  onToggle,
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

  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : user.id);
  }, [isOpen, user.id, onToggle]);

  const isCurrentUser = useMemo(
    () => currentUserId === user.id,
    [currentUserId, user.id],
  );

  return (
    <ContextMenu isOpen={isOpen} onToggle={handleToggle}>
      <ContextMenu.Trigger
        title={t('admin:users.list.moreActions', 'More actions')}
      >
        <Icon name='more-vertical' size={18} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => history.push(`/admin/users/${user.id}/api-keys`)}
          icon={<Icon name='key' size={16} />}
          permission='apiKeys:read'
        >
          {t('admin:users.list.manageApiKeys', 'Manage API Keys')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageGroups(user)}
          icon={<Icon name='folder' size={16} />}
          permission='groups:*'
        >
          {t('admin:users.list.manageGroups', 'Manage Groups')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageRoles(user)}
          icon={<Icon name='shield' size={16} />}
          permission='roles:*'
        >
          {t('admin:users.list.manageRoles', 'Manage Roles')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onViewPermissions(user)}
          icon={<Icon name='lock' size={16} />}
          permission='permissions:read'
        >
          {t('admin:users.list.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        {!isCurrentUser && (
          <ContextMenu.Item
            onClick={() => onImpersonate(user)}
            icon={<Icon name='user' size={16} />}
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
                icon={<Icon name='close' size={16} />}
                variant='danger'
                permission={['users:update', 'users:delete']}
              >
                {t('admin:users.list.deactivate', 'Deactivate')}
              </ContextMenu.Item>
            ) : (
              <ContextMenu.Item
                onClick={() => onActivate(user)}
                icon={<Icon name='check' size={16} />}
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
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onManageRoles: PropTypes.func.isRequired,
  onManageGroups: PropTypes.func.isRequired,
  onViewPermissions: PropTypes.func.isRequired,
  onActivate: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  onImpersonate: PropTypes.func.isRequired,
};

export default UserActionsDropdown;
