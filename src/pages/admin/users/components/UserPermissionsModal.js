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
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import {
  fetchUserPermissions,
  clearPermissions,
  getUserPermissions,
  getUserPermissionsLoading,
  getRoles,
} from '../../../../redux';
import s from './Modal.css';

/**
 * UserPermissionsModal - Self-contained modal for viewing user permissions
 *
 * Displays all permissions inherited from the user's assigned roles and groups.
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(user);      // Open for user
 *   permissionsModalRef.current.close();         // Close modal
 */
const UserPermissionsModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const permissions = useSelector(getUserPermissions);
  const loading = useSelector(getUserPermissionsLoading);
  const allRoles = useSelector(getRoles);

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

  // Calculate role details from user's roles
  const roleDetails = useMemo(() => {
    if (!user || !user.roles) {
      return [];
    }

    const details = [];
    const userRoles = Array.isArray(user.roles) ? user.roles : [];

    userRoles.forEach(userRole => {
      const roleName = typeof userRole === 'string' ? userRole : userRole.name;
      // Find full role data with permissions
      const fullRole = allRoles.find(
        r => r.name === roleName || r.id === userRole.id,
      );

      if (fullRole && fullRole.permissions) {
        details.push({
          name: fullRole.name,
          permissions: fullRole.permissions.map(p => p.name || p),
        });
      } else {
        details.push({
          name: roleName || 'Unknown',
          permissions: [],
        });
      }
    });

    return details;
  }, [user, allRoles]);

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
            Permissions for &quot;{user?.display_name || user?.email}&quot;
          </h3>
          <button className={s.modalClose} onClick={handleClose} type='button'>
            ×
          </button>
        </div>
        <div className={s.modalBody}>
          <p className={s.modalDescription}>
            These permissions are inherited from the user&apos;s assigned roles
            and groups.
          </p>

          {loading ? (
            <p>Loading permissions...</p>
          ) : (
            <>
              {/* Role breakdown */}
              {roleDetails.length > 0 && (
                <div className={s.roleBreakdown}>
                  <h4 className={s.sectionTitle}>Assigned Roles</h4>
                  <div className={s.rolesList}>
                    {roleDetails.map(role => (
                      <div key={role.name} className={s.roleItem}>
                        <span className={s.roleName}>{role.name}</span>
                        <span className={s.rolePermCount}>
                          {role.permissions.length} permission
                          {role.permissions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All permissions */}
              <div className={s.permissionsSection}>
                <h4 className={s.sectionTitle}>
                  Effective Permissions ({permissions.length})
                </h4>
                {permissions.length > 0 ? (
                  <div className={s.permissionsList}>
                    {permissions.map(perm => (
                      <span key={perm} className={s.permissionBadge}>
                        {perm}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={s.noPermissions}>
                    No permissions. Assign roles to grant permissions.
                  </p>
                )}
              </div>
            </>
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

UserPermissionsModal.displayName = 'UserPermissionsModal';

export default UserPermissionsModal;
