/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { getUserId } from '../../../../../../shared/renderer/redux';
import {
  Icon,
  Table,
} from '../../../../../../shared/renderer/components/Admin';

const { ActionsDropdown } = Table;

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
}) {
  const currentUserId = useSelector(getUserId);

  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : user.id);
  }, [isOpen, user.id, onToggle]);

  const isCurrentUser = useMemo(
    () => currentUserId === user.id,
    [currentUserId, user.id],
  );

  return (
    <ActionsDropdown isOpen={isOpen} onToggle={handleToggle}>
      <ActionsDropdown.Trigger title='More actions'>
        <Icon name='more-vertical' size={18} />
      </ActionsDropdown.Trigger>
      <ActionsDropdown.Menu>
        <ActionsDropdown.Item
          onClick={() => onManageGroups(user)}
          icon={<Icon name='folder' size={16} />}
        >
          Manage Groups
        </ActionsDropdown.Item>
        <ActionsDropdown.Item
          onClick={() => onManageRoles(user)}
          icon={<Icon name='shield' size={16} />}
        >
          Manage Roles
        </ActionsDropdown.Item>
        <ActionsDropdown.Divider />
        <ActionsDropdown.Item
          onClick={() => onViewPermissions(user)}
          icon={<Icon name='key' size={16} />}
        >
          View Permissions
        </ActionsDropdown.Item>
        {!isCurrentUser && (
          <>
            <ActionsDropdown.Divider />
            {user.is_active ? (
              <ActionsDropdown.Item
                onClick={() => onDeactivate(user)}
                icon={<Icon name='close' size={16} />}
                variant='danger'
              >
                Deactivate
              </ActionsDropdown.Item>
            ) : (
              <ActionsDropdown.Item
                onClick={() => onActivate(user)}
                icon={<Icon name='check' size={16} />}
              >
                Activate
              </ActionsDropdown.Item>
            )}
          </>
        )}
      </ActionsDropdown.Menu>
    </ActionsDropdown>
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
};

export default UserActionsDropdown;
