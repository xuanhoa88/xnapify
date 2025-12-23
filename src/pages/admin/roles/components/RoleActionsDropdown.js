/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../../components/Admin';
import s from './RoleActionsDropdown.css';

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

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (isOpen) {
        onToggle(null);
      }
    };
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  const handleToggle = useCallback(
    e => {
      e.stopPropagation();
      onToggle(role.id);
    },
    [role.id, onToggle],
  );

  const handleAction = useCallback(
    action => {
      action(role);
      onToggle(null);
    },
    [role, onToggle],
  );

  return (
    <div className={s.actionDropdown}>
      <button
        className={s.actionDropdownBtn}
        title={t('common.moreActions', 'More actions')}
        onClick={handleToggle}
        type='button'
      >
        ⋮
      </button>
      {isOpen && (
        <div
          className={s.actionDropdownMenu}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          role='menu'
          aria-label={t('roles.actions', 'Role actions')}
          tabIndex={-1}
        >
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onViewUsers)}
            type='button'
            role='menuitem'
          >
            <Icon name='users' size={16} />
            {t('roles.viewUsers', 'View Users')}
          </button>
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onViewGroups)}
            type='button'
            role='menuitem'
          >
            <Icon name='folder' size={16} />
            {t('roles.viewGroups', 'View Groups')}
          </button>
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onViewPermissions)}
            type='button'
            role='menuitem'
          >
            <Icon name='key' size={16} />
            {t('roles.viewPermissions', 'View Permissions')}
          </button>
          <div className={s.dropdownDivider} />
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onEdit)}
            type='button'
            role='menuitem'
          >
            <Icon name='edit' size={16} />
            {t('roles.editRole', 'Edit Role')}
          </button>
          <button
            className={`${s.dropdownItem} ${s.dropdownItemDanger}`}
            onClick={() => handleAction(onDelete)}
            type='button'
            role='menuitem'
          >
            <Icon name='trash' size={16} />
            {t('roles.deleteRole', 'Delete Role')}
          </button>
        </div>
      )}
    </div>
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
