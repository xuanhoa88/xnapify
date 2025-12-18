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
import { useDispatch } from 'react-redux';
import { Modal } from '../../../../components/Modal';
import { fetchGroupPermissions } from '../../../../redux';
import s from './GroupPermissionsModal.css';

/**
 * GroupPermissionsModal - Self-contained modal for viewing group permissions
 *
 * Displays all permissions inherited from the group's assigned roles.
 * Uses the dedicated /api/admin/groups/:id/permissions endpoint.
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(group);      // Open for group
 *   permissionsModalRef.current.close();          // Close modal
 */
const GroupPermissionsModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();

  // Loading and data state
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [roleDetails, setRoleDetails] = useState([]);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);

  // Fetch permissions when modal opens
  useEffect(() => {
    if (isOpen && group) {
      const loadPermissions = async () => {
        setLoading(true);
        const result = await dispatch(fetchGroupPermissions(group.id));
        if (result.success) {
          setPermissions(result.permissions);
          setRoleDetails(result.roleDetails);
        }
        setLoading(false);
      };
      loadPermissions();
    }
  }, [dispatch, isOpen, group]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setGroup(null);
    setPermissions([]);
    setRoleDetails([]);
    setLoading(false);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetGroup => {
        setGroup(targetGroup);
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
        Permissions for &quot;{group && group.name}&quot;
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          These permissions are inherited from the group&apos;s assigned roles.
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

GroupPermissionsModal.displayName = 'GroupPermissionsModal';

export default GroupPermissionsModal;
