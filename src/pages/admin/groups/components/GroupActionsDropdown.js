/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import PropTypes from 'prop-types';
import s from './GroupActionsDropdown.css';

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
  onViewMembers,
  onManageRoles,
  onViewPermissions,
  onEdit,
  onDelete,
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

  const handleToggle = e => {
    e.stopPropagation();
    onToggle(group.id);
  };

  const handleAction = action => {
    action(group);
    onToggle(null);
  };

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
          aria-label='Group actions'
          tabIndex={-1}
        >
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onViewMembers)}
            type='button'
            role='menuitem'
          >
            👥 View Members
          </button>
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onManageRoles)}
            type='button'
            role='menuitem'
          >
            🏷️ Manage Roles
          </button>
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onViewPermissions)}
            type='button'
            role='menuitem'
          >
            🔐 View Permissions
          </button>
          <div className={s.dropdownDivider} />
          <button
            className={s.dropdownItem}
            onClick={() => handleAction(onEdit)}
            type='button'
            role='menuitem'
          >
            ✏️ Edit Group
          </button>
          <button
            className={`${s.dropdownItem} ${s.dropdownItemDanger}`}
            onClick={() => handleAction(onDelete)}
            type='button'
            role='menuitem'
          >
            🗑️ Delete Group
          </button>
        </div>
      )}
    </div>
  );
}

GroupActionsDropdown.propTypes = {
  group: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onViewMembers: PropTypes.func.isRequired,
  onManageRoles: PropTypes.func.isRequired,
  onViewPermissions: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default GroupActionsDropdown;
