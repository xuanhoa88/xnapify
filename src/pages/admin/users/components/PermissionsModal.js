/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import {
  fetchUserPermissions,
  clearPermissions,
  getUserPermissions,
  getUserPermissionsLoading,
} from '../../../../redux';
import s from './Modal.css';

/**
 * PermissionsModal - Self-contained modal for viewing user permissions
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(user);      // Open for user
 *   permissionsModalRef.current.close();         // Close modal
 */
const PermissionsModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const permissions = useSelector(getUserPermissions);
  const loading = useSelector(getUserPermissionsLoading);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch permissions when user changes
  useEffect(() => {
    if (isOpen && user) {
      dispatch(fetchUserPermissions(user.id));
    }
    return () => {
      if (!isOpen) {
        dispatch(clearPermissions());
      }
    };
  }, [dispatch, isOpen, user]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setUser(null);
        dispatch(clearPermissions());
      },
    }),
    [dispatch],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    dispatch(clearPermissions());
  }, [dispatch]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className={s.modalOverlay} onClick={handleClose} role='presentation'>
      <div
        className={s.modal}
        onClick={e => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
      >
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>
            Permissions for {user && (user.display_name || user.email)}
          </h3>
          <button className={s.modalClose} onClick={handleClose} type='button'>
            ×
          </button>
        </div>
        <div className={s.modalBody}>
          {loading ? (
            <p>Loading permissions...</p>
          ) : permissions.length > 0 ? (
            <div className={s.permissionsList}>
              {permissions.map(perm => (
                <span key={perm} className={s.permissionBadge}>
                  {perm}
                </span>
              ))}
            </div>
          ) : (
            <p className={s.noPermissions}>No permissions assigned.</p>
          )}
        </div>
        <div className={s.modalFooter}>
          <button
            className={clsx(s.modalBtn, s.modalBtnSecondary)}
            onClick={handleClose}
            type='button'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

PermissionsModal.displayName = 'PermissionsModal';

export default PermissionsModal;
