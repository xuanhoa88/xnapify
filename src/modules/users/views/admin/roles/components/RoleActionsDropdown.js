/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, Table } from '../../../../../../components/Admin';

const { ActionsDropdown } = Table;

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
    <ActionsDropdown isOpen={isOpen} onToggle={handleToggle}>
      <ActionsDropdown.Trigger title={t('common.moreActions', 'More actions')}>
        <Icon name='more-vertical' size={18} />
      </ActionsDropdown.Trigger>
      <ActionsDropdown.Menu>
        <ActionsDropdown.Item
          onClick={() => onViewUsers(role)}
          icon={<Icon name='users' size={16} />}
        >
          {t('roles.viewUsers', 'View Users')}
        </ActionsDropdown.Item>
        <ActionsDropdown.Item
          onClick={() => onViewGroups(role)}
          icon={<Icon name='folder' size={16} />}
        >
          {t('roles.viewGroups', 'View Groups')}
        </ActionsDropdown.Item>
        <ActionsDropdown.Item
          onClick={() => onViewPermissions(role)}
          icon={<Icon name='key' size={16} />}
        >
          {t('roles.viewPermissions', 'View Permissions')}
        </ActionsDropdown.Item>
        <ActionsDropdown.Divider />
        <ActionsDropdown.Item
          onClick={() => onEdit(role)}
          icon={<Icon name='edit' size={16} />}
        >
          {t('roles.editRole', 'Edit Role')}
        </ActionsDropdown.Item>
        <ActionsDropdown.Item
          onClick={() => onDelete(role)}
          icon={<Icon name='trash' size={16} />}
          variant='danger'
        >
          {t('roles.deleteRole', 'Delete Role')}
        </ActionsDropdown.Item>
      </ActionsDropdown.Menu>
    </ActionsDropdown>
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
