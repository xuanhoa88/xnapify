/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Icon,
  Table,
} from '../../../../../../shared/renderer/components/Admin';

const { ActionsDropdown } = Table;

/**
 * GroupActionsDropdown - Dropdown menu for group actions
 *
 * To ensure only one dropdown is open at a time, pass `isOpen` and `onToggle` from parent.
 * Parent should manage activeDropdownId state and pass `isOpen={activeDropdownId === group.id}`
 * and `onToggle={(id) => setActiveDropdownId(prev => prev === id ? null : id)}`
 */
function GroupActionsDropdown({
  group,
  isOpen,
  onToggle,
  onViewUsers,
  onManageRoles,
  onViewPermissions,
  onEdit,
  onDelete,
}) {
  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : group.id);
  }, [isOpen, group.id, onToggle]);

  return (
    <ActionsDropdown isOpen={isOpen} onToggle={handleToggle}>
      <ActionsDropdown.Trigger title='More actions'>
        <Icon name='more-vertical' size={18} />
      </ActionsDropdown.Trigger>
      <ActionsDropdown.Menu>
        <ActionsDropdown.Item
          onClick={() => onViewUsers(group)}
          icon={<Icon name='users' size={16} />}
        >
          View Users
        </ActionsDropdown.Item>
        <ActionsDropdown.Item
          onClick={() => onManageRoles(group)}
          icon={<Icon name='shield' size={16} />}
        >
          Manage Roles
        </ActionsDropdown.Item>
        <ActionsDropdown.Item
          onClick={() => onViewPermissions(group)}
          icon={<Icon name='key' size={16} />}
        >
          View Permissions
        </ActionsDropdown.Item>
        <ActionsDropdown.Divider />
        <ActionsDropdown.Item
          onClick={() => onEdit(group)}
          icon={<Icon name='edit' size={16} />}
        >
          Edit Group
        </ActionsDropdown.Item>
        <ActionsDropdown.Item
          onClick={() => onDelete(group)}
          icon={<Icon name='trash' size={16} />}
          variant='danger'
        >
          Delete Group
        </ActionsDropdown.Item>
      </ActionsDropdown.Menu>
    </ActionsDropdown>
  );
}

GroupActionsDropdown.propTypes = {
  group: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onViewUsers: PropTypes.func.isRequired,
  onManageRoles: PropTypes.func.isRequired,
  onViewPermissions: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default GroupActionsDropdown;
