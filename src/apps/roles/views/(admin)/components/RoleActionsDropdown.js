/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../../../shared/renderer/components/Admin';
import ContextMenu from '../../../../../shared/renderer/components/ContextMenu';

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
        <Icon name='more-vertical' size={18} />
      </ContextMenu.Trigger>
      <ContextMenu.Menu>
        <ContextMenu.Item
          onClick={() => onViewUsers(role)}
          icon={<Icon name='users' size={16} />}
          permission='users:read'
        >
          {t('admin:roles.viewUsers', 'View Users')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewGroups(role)}
          icon={<Icon name='folder' size={16} />}
          permission='groups:read'
        >
          {t('admin:roles.viewGroups', 'View Groups')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onViewPermissions(role)}
          icon={<Icon name='key' size={16} />}
          permission='permissions:read'
        >
          {t('admin:roles.viewPermissions', 'View Permissions')}
        </ContextMenu.Item>
        <ContextMenu.Divider />
        <ContextMenu.Item
          onClick={() => onEdit(role)}
          icon={<Icon name='edit' size={16} />}
          permission='roles:update'
        >
          {t('admin:roles.editRole', 'Edit Role')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => onDelete(role)}
          icon={<Icon name='trash' size={16} />}
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
