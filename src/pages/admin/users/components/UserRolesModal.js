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
 * UserRolesModal - Self-contained modal for managing user roles
 *
 * Usage:
 *   const rolesModalRef = useRef();
 *   rolesModalRef.current.open(user);           // Open for single user
 *   rolesModalRef.current.openBulk(userIds);    // Open for bulk assignment
 *   rolesModalRef.current.close();              // Close modal
 */
const UserRolesModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const roles = useSelector(getRoles);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        setError(null);
        setIsOpen(true);
      },
      openBulk: userIds => {
        setUser(null);
        setIsBulk(true);
        setBulkUserIds(userIds);
        setSelections([]);
        setError(null);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setUser(null);
        setIsBulk(false);
        setBulkUserIds([]);
        setSelections([]);
        setError(null);
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
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetUsers = isBulk ? bulkUserIds : [user.id];
      for (const userId of targetUsers) {
        const result = await dispatch(assignRolesToUser(userId, selections));
        if (!result.success) {
          setError(result.error || 'Failed to assign roles');
          setLoading(false);
          return;
        }
      }
      // Refresh users list
      dispatch(fetchUsers({}));
      handleClose();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [dispatch, isBulk, bulkUserIds, user, selections, handleClose]);

  // Don't render if not open
  if (!isOpen) return null;

  const title = isBulk
    ? `Assign Roles to ${bulkUserIds.length} Users`
    : `Manage Roles for "${user && (user.display_name || user.email)}"`;

  const description = isBulk
    ? 'Select roles to assign to the selected users.'
    : "Select roles to assign to this user. The user's permissions will be based on these roles.";

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
          {error && <div className={s.modalError}>{error}</div>}
          <p className={s.modalDescription}>{description}</p>
          <div className={s.checkboxList}>
            {roles.length === 0 ? (
              <div className={s.noItems}>No roles available</div>
            ) : (
              roles.map(role => (
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
                  <div className={s.checkboxContent}>
                    <span className={s.checkboxListLabel}>{role.name}</span>
                    {role.description && (
                      <span className={s.checkboxListDesc}>
                        {role.description}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className={s.modalFooter}>
          <span className={s.selectionCount}>
            {selections.length} role{selections.length !== 1 ? 's' : ''}{' '}
            selected
          </span>
          <div className={s.modalActions}>
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
    </div>
  );
});

UserRolesModal.displayName = 'UserRolesModal';

export default UserRolesModal;
