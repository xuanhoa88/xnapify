/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Icon } from '../../../../components/Admin';
import s from './UserActionsDropdown.css';

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
      onToggle(user.id);
    },
    [user.id, onToggle],
  );

  const handleAction = useCallback(
    action => {
      action(user);
      onToggle(null);
    },
    [user, onToggle],
  );

  return (
    <div className={s.actionDropdown}>
      <button
        className={s.actionDropdownBtn}
        title='More actions'
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
          aria-label='User actions'
          tabIndex={-1}
        >
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onManageGroups)}
            type='button'
            role='menuitem'
          >
            <Icon name='folder' size={16} /> Manage Groups
          </button>
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onManageRoles)}
            type='button'
            role='menuitem'
          >
            <Icon name='shield' size={16} /> Manage Roles
          </button>
          <div className={s.dropdownDivider} />
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onViewPermissions)}
            type='button'
            role='menuitem'
          >
            <Icon name='key' size={16} /> View Permissions
          </button>
        </div>
      )}
    </div>
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
