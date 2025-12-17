/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { getGroups, assignGroupsToUser, fetchUsers } from '../../../../redux';
import s from './Modal.css';

/**
 * UserGroupsModal - Self-contained modal for managing user groups
 *
 * Usage:
 *   const groupsModalRef = useRef();
 *   groupsModalRef.current.open(user);           // Open for single user
 *   groupsModalRef.current.openBulk(userIds);    // Open for bulk assignment
 *   groupsModalRef.current.close();              // Close modal
 */
const UserGroupsModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const groups = useSelector(getGroups);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize selections from user groups
  const initSelections = useCallback(targetUser => {
    if (targetUser && targetUser.groups) {
      const userGroupIds = targetUser.groups.map(g => g.id);
      setSelections(userGroupIds);
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

  const toggleSelection = useCallback(id => {
    setSelections(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
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
        const result = await dispatch(assignGroupsToUser(userId, selections));
        if (!result.success) {
          setError(result.error || 'Failed to assign groups');
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
    ? `Assign Groups to ${bulkUserIds.length} Users`
    : `Manage Groups for "${user?.display_name || user?.email}"`;

  const description = isBulk
    ? 'Select groups to assign to the selected users.'
    : 'Select groups for this user. The user will inherit roles from these groups.';

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
            {groups.length === 0 ? (
              <div className={s.noItems}>No groups available</div>
            ) : (
              groups.map(group => (
                <div
                  key={group.id}
                  className={clsx(s.checkboxListItem, {
                    [s.selected]: selections.includes(group.id),
                  })}
                  onClick={() => toggleSelection(group.id)}
                  role='checkbox'
                  aria-checked={selections.includes(group.id)}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleSelection(group.id);
                    }
                  }}
                >
                  <input
                    type='checkbox'
                    className={s.checkbox}
                    checked={selections.includes(group.id)}
                    onChange={() => {}}
                    tabIndex={-1}
                  />
                  <div className={s.checkboxContent}>
                    <span className={s.checkboxListLabel}>{group.name}</span>
                    {group.description && (
                      <span className={s.checkboxListDesc}>
                        {group.description}
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
            {selections.length} group{selections.length !== 1 ? 's' : ''}{' '}
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

UserGroupsModal.displayName = 'UserGroupsModal';

export default UserGroupsModal;
