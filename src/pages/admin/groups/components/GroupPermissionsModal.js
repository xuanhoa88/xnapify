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
  useMemo,
} from 'react';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import { getRoles } from '../../../../redux';
import s from './Modal.css';

/**
 * GroupPermissionsModal - Self-contained modal for viewing group permissions
 *
 * Displays all permissions inherited from the group's assigned roles.
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(group);      // Open for group
 *   permissionsModalRef.current.close();          // Close modal
 */
const GroupPermissionsModal = forwardRef((props, ref) => {
  const allRoles = useSelector(getRoles);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);

  // Calculate permissions from group's roles
  const { permissions, roleDetails } = useMemo(() => {
    if (!group || !group.roles) {
      return { permissions: [], roleDetails: [] };
    }

    const permSet = new Set();
    const details = [];

    // Get permissions from each role
    group.roles.forEach(groupRole => {
      // Find full role data with permissions
      const fullRole = allRoles.find(
        r => r.id === groupRole.id || r.name === groupRole.name,
      );

      if (fullRole && fullRole.permissions) {
        const rolePerms = fullRole.permissions.map(p => p.name || p);
        rolePerms.forEach(p => permSet.add(p));
        details.push({
          name: fullRole.name,
          permissions: rolePerms,
        });
      } else if (groupRole.permissions) {
        // Fallback if role already has permissions attached
        const rolePerms = groupRole.permissions.map(p => p.name || p);
        rolePerms.forEach(p => permSet.add(p));
        details.push({
          name: groupRole.name,
          permissions: rolePerms,
        });
      } else {
        details.push({
          name: groupRole.name || groupRole,
          permissions: [],
        });
      }
    });

    return {
      permissions: Array.from(permSet).sort(),
      roleDetails: details,
    };
  }, [group, allRoles]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetGroup => {
        setGroup(targetGroup);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setGroup(null);
      },
    }),
    [],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setGroup(null);
  }, []);

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
            Permissions for &quot;{group?.name}&quot;
          </h3>
          <button className={s.modalClose} onClick={handleClose} type='button'>
            ×
          </button>
        </div>
        <div className={s.modalBody}>
          <p className={s.modalDescription}>
            These permissions are inherited from the group&apos;s assigned
            roles.
          </p>

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

GroupPermissionsModal.displayName = 'GroupPermissionsModal';

export default GroupPermissionsModal;
