/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { getRoles, assignRolesToGroup, fetchGroups } from '../../../../redux';
import s from './Modal.css';

/**
 * GroupRolesModal - Self-contained modal for managing group roles
 *
 * Usage:
 *   const rolesModalRef = useRef();
 *   rolesModalRef.current.open(group);    // Open for a group
 *   rolesModalRef.current.close();        // Close modal
 */
const GroupRolesModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const roles = useSelector(getRoles);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize selections from group roles
  const initSelections = useCallback(targetGroup => {
    if (targetGroup && targetGroup.roles) {
      const groupRoles = Array.isArray(targetGroup.roles)
        ? targetGroup.roles.map(r => r.name || r)
        : [];
      setSelections([...new Set(groupRoles)]);
    } else {
      setSelections([]);
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetGroup => {
        setGroup(targetGroup);
        initSelections(targetGroup);
        setError(null);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setGroup(null);
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
    setGroup(null);
    setSelections([]);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dispatch(assignRolesToGroup(group.id, selections));
      if (result.success) {
        // Refresh groups list
        dispatch(fetchGroups({ page: 1 }));
        handleClose();
      } else {
        setError(result.error || 'Failed to assign roles');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [dispatch, group, selections, handleClose]);

  // Don't render if not open
  if (!isOpen) return null;

  const title = `Manage Roles for "${(group && group.name) || 'Group'}"`;

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
          <p className={s.modalDescription}>
            Select roles to assign to this group. All members of the group will
            inherit these roles.
          </p>
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

GroupRolesModal.displayName = 'GroupRolesModal';

export default GroupRolesModal;
