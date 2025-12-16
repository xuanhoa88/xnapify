/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { getRoles, assignRolesToUser, fetchUsers } from '../../../../redux';
import s from './Modal.css';

/**
 * RolesModal - Self-contained modal for managing user roles
 *
 * Usage:
 *   const rolesModalRef = useRef();
 *   rolesModalRef.current.open(user);           // Open for single user
 *   rolesModalRef.current.openBulk(userIds);    // Open for bulk assignment
 *   rolesModalRef.current.close();              // Close modal
 */
const RolesModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const roles = useSelector(getRoles);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize selections from user roles
  const initSelections = useCallback(targetUser => {
    if (targetUser) {
      const userRoles = Array.isArray(targetUser.roles)
        ? [...new Set(targetUser.roles)]
        : [];
      setSelections(userRoles);
    } else {
      setSelections([]);
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
        setIsBulk(false);
        setBulkUserIds([]);
        initSelections(targetUser);
        setIsOpen(true);
      },
      openBulk: userIds => {
        setUser(null);
        setIsBulk(true);
        setBulkUserIds(userIds);
        setSelections([]);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setUser(null);
        setIsBulk(false);
        setBulkUserIds([]);
        setSelections([]);
      },
    }),
    [initSelections],
  );

  const toggleSelection = useCallback(role => {
    setSelections(prev =>
      prev.includes(role) ? prev.filter(x => x !== role) : [...prev, role],
    );
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    setIsBulk(false);
    setBulkUserIds([]);
    setSelections([]);
  }, []);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      const targetUsers = isBulk ? bulkUserIds : [user.id];
      for (const userId of targetUsers) {
        await dispatch(assignRolesToUser(userId, selections));
      }
      // Refresh users list
      dispatch(fetchUsers({}));
      handleClose();
    } finally {
      setLoading(false);
    }
  }, [dispatch, isBulk, bulkUserIds, user, selections, handleClose]);

  // Don't render if not open
  if (!isOpen) return null;

  const title = isBulk
    ? `Assign Roles to ${bulkUserIds.length} Users`
    : `Manage Roles for ${user && (user.display_name || user.email)}`;

  return (
    <div className={s.modalOverlay} onClick={handleClose} role='presentation'>
      <div
        className={s.modal}
        onClick={e => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
      >
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>{title}</h3>
          <button className={s.modalClose} onClick={handleClose} type='button'>
            ×
          </button>
        </div>
        <div className={s.modalBody}>
          <div className={s.checkboxList}>
            {roles.map(role => (
              <div
                key={role.id}
                className={clsx(s.checkboxListItem, {
                  [s.selected]: selections.includes(role.name),
                })}
                onClick={() => toggleSelection(role.name)}
                role='checkbox'
                aria-checked={selections.includes(role.name)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleSelection(role.name);
                  }
                }}
              >
                <input
                  type='checkbox'
                  className={s.checkbox}
                  checked={selections.includes(role.name)}
                  onChange={() => {}}
                  tabIndex={-1}
                />
                <span className={s.checkboxListLabel}>{role.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={s.modalFooter}>
          <button
            className={clsx(s.modalBtn, s.modalBtnSecondary)}
            onClick={handleClose}
            type='button'
          >
            Cancel
          </button>
          <button
            className={clsx(s.modalBtn, s.modalBtnPrimary)}
            onClick={handleSave}
            disabled={loading}
            type='button'
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
});

RolesModal.displayName = 'RolesModal';

export default RolesModal;
