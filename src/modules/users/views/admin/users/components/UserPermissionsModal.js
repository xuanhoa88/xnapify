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
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../../../../components/Modal';
import s from './UserPermissionsModal.css';
import {
  fetchUserPermissions,
  clearUserPermissions,
  getUserPermissions,
  isUserPermissionsOperationLoading,
} from '../redux';

/**
 * UserPermissionsModal - Self-contained modal for viewing user permissions
 *
 * Displays all permissions inherited from the user's assigned roles and groups.
 * Uses the dedicated /api/admin/users/:id/permissions endpoint.
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(user);      // Open for user
 *   permissionsModalRef.current.close();         // Close modal
 */
const UserPermissionsModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const permissions = useSelector(getUserPermissions);
  const loading = useSelector(isUserPermissionsOperationLoading);

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
        dispatch(clearUserPermissions());
      }
    };
  }, [dispatch, isOpen, user]);

  // Calculate role details from user's roles (already available in user object)
  const roleDetails = useMemo(() => {
    if (!user || !user.roles) {
      return [];
    }

    const userRoles = Array.isArray(user.roles) ? user.roles : [];

    return userRoles.map(role => ({
      id: role.id,
      name: typeof role === 'string' ? role : role.name,
      // Use permissions count from role object if available
      permissionCount: role.permissions ? role.permissions.length : 0,
    }));
  }, [user]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    dispatch(clearUserPermissions());
  }, [dispatch]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        Permissions for &quot;
        {(user && (user.display_name || user.email)) ||
          t('common.unknown', 'Unknown')}
        &quot;
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          These permissions are inherited from the user&apos;s assigned roles
          and groups.
        </Modal.Description>

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
                    <div key={role.id || role.name} className={s.roleItem}>
                      <span className={s.roleName}>{role.name}</span>
                      {role.permissionCount > 0 && (
                        <span className={s.rolePermCount}>
                          {role.permissionCount} permission
                          {role.permissionCount !== 1 ? 's' : ''}
                        </span>
                      )}
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
      </Modal.Body>
      <Modal.Footer>
        <Modal.Button onClick={handleClose}>Close</Modal.Button>
      </Modal.Footer>
    </Modal>
  );
});

UserPermissionsModal.displayName = 'UserPermissionsModal';

export default UserPermissionsModal;
