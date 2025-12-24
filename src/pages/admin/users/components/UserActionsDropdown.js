/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Icon, Table } from '../../../../components/Admin';

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
}) {
  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : user.id);
  }, [isOpen, user.id, onToggle]);

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
};

export default UserActionsDropdown;
