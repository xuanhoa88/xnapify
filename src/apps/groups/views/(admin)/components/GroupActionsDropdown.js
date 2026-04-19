/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';

import {
  DotsVerticalIcon,
  GroupIcon,
  LockClosedIcon,
  LockOpen1Icon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '@shared/renderer/components/ContextMenu';
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
  const { t } = useTranslation();

  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : group.id);
  }, [isOpen, group.id, onToggle]);

  return (
    <ContextMenu isOpen={isOpen} onToggle={handleToggle}>
      <ContextMenu.Trigger
        title={t('admin:common.moreActions', 'More actions')}
      >
        <DotsVerticalIcon width={18} height={18} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => onViewUsers(group)}
          icon={<GroupIcon width={16} height={16} />}
          permission='users:read'
        >
          {t('admin:groups.viewUsers', 'View Users')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onManageRoles(group)}
          icon={<LockClosedIcon width={16} height={16} />}
          permission='roles:*'
        >
          {t('admin:groups.manageRoles', 'Manage Roles')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewPermissions(group)}
          icon={<LockOpen1Icon width={16} height={16} />}
          permission='permissions:read'
        >
          {t('admin:groups.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onEdit(group)}
          icon={<Pencil2Icon width={16} height={16} />}
          permission='groups:update'
        >
          {t('admin:groups.editGroup', 'Edit Group')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onDelete(group)}
          icon={<TrashIcon width={16} height={16} />}
          variant='danger'
          permission='groups:delete'
        >
          {t('admin:groups.deleteGroup', 'Delete Group')}
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
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
