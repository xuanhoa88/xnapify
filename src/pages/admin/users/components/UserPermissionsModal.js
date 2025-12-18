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
import { Modal } from '../../../../components/Modal';
import s from './UserPermissionsModal.css';
import {
  fetchUserPermissions,
  clearPermissions,
  getUserPermissions,
  getUserPermissionsLoading,
  fetchRoles,
} from '../../../../redux';

/**
 * UserPermissionsModal - Self-contained modal for viewing user permissions
 *
 * Displays all permissions inherited from the user's assigned roles and groups.
 * Uses local state for roles to avoid conflicts with the Roles admin page.
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

  // Local state for roles (independent from Redux to avoid conflicts)
  const [localRoles, setLocalRoles] = useState([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch roles into local state when modal opens
  useEffect(() => {
    if (isOpen && !rolesLoaded) {
      const loadRoles = async () => {
        const result = await dispatch(fetchRoles({ limit: 1000 }));
        if (result.success && result.data) {
          if (Array.isArray(result.data.roles)) {
            setLocalRoles(result.data.roles);
          }
        }
        setRolesLoaded(true);
      };
      loadRoles();
    }
  }, [dispatch, isOpen, rolesLoaded]);

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
      // Find full role data with permissions from local state
      const fullRole = localRoles.find(
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
  }, [user, localRoles]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    setLocalRoles([]);
    setRolesLoaded(false);
    dispatch(clearPermissions());
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
        Permissions for &quot;{user && (user.display_name || user.email)}&quot;
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          These permissions are inherited from the user&apos;s assigned roles
          and groups.
        </Modal.Description>

        {loading || !rolesLoaded ? (
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
      </Modal.Body>
      <Modal.Footer>
        <Modal.Button onClick={handleClose}>Close</Modal.Button>
      </Modal.Footer>
    </Modal>
  );
});

UserPermissionsModal.displayName = 'UserPermissionsModal';

export default UserPermissionsModal;
