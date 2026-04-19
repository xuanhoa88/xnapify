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
  ArchiveIcon,
  LockOpen1Icon,
  Pencil2Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '@shared/renderer/components/ContextMenu';
/**
 * RoleActionsDropdown - Dropdown menu for role actions
 *
 * To ensure only one dropdown is open at a time, pass `isOpen` and `onToggle` from parent.
 * Parent should manage activeDropdownId state and pass `isOpen={activeDropdownId === role.id}`
 * and `onToggle={(id) => setActiveDropdownId(prev => prev === id ? null : id)}`
 */
function RoleActionsDropdown({
  role,
  isOpen,
  onToggle,
  onViewUsers,
  onViewGroups,
  onViewPermissions,
  onEdit,
  onDelete,
}) {
  const { t } = useTranslation();

  const handleToggle = useCallback(() => {
    onToggle(isOpen ? null : role.id);
  }, [isOpen, role.id, onToggle]);

  return (
    <ContextMenu isOpen={isOpen} onToggle={handleToggle}>
      <ContextMenu.Trigger
        title={t('admin:common.moreActions', 'More actions')}
      >
        <DotsVerticalIcon width={18} height={18} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => onViewUsers(role)}
          icon={<GroupIcon width={16} height={16} />}
          permission='users:read'
        >
          {t('admin:roles.viewUsers', 'View Users')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewGroups(role)}
          icon={<ArchiveIcon width={16} height={16} />}
          permission='groups:read'
        >
          {t('admin:roles.viewGroups', 'View Groups')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewPermissions(role)}
          icon={<LockOpen1Icon width={16} height={16} />}
          permission='permissions:read'
        >
          {t('admin:roles.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onEdit(role)}
          icon={<Pencil2Icon width={16} height={16} />}
          permission='roles:update'
        >
          {t('admin:roles.editRole', 'Edit Role')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onDelete(role)}
          icon={<TrashIcon width={16} height={16} />}
          variant='danger'
          permission='roles:delete'
        >
          {t('admin:roles.deleteRole', 'Delete Role')}
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

RoleActionsDropdown.propTypes = {
  role: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onViewUsers: PropTypes.func.isRequired,
  onViewGroups: PropTypes.func.isRequired,
  onViewPermissions: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default RoleActionsDropdown;
