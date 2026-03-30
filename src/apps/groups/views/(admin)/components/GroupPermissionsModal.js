/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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

import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';

import {
  fetchGroupPermissions,
  isGroupFetchPermissionsLoading,
} from '../redux';

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
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isGroupFetchPermissionsLoading);

  // Data state
  const [permissions, setPermissions] = useState([]);
  const [roleDetails, setRoleDetails] = useState([]);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);

  // Fetch permissions when modal opens
  useEffect(() => {
    if (isOpen && group) {
      const loadPermissions = async () => {
        try {
          const data = await dispatch(fetchGroupPermissions(group.id)).unwrap();
          setPermissions(data.permissions || []);
          setRoleDetails(data.roleDetails || []);
        } catch (err) {
          // Silently handle error
        }
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
        {t('admin:groups.permissionsFor', 'Permissions for "{{groupName}}"', {
          groupName:
            (group && group.name) || t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          {t(
            'admin:groups.permissionsDescription',
            "These permissions are inherited from the group's assigned roles.",
          )}
        </Modal.Description>

        {loading ? (
          <p>
            {t('admin:common.loadingPermissions', 'Loading permissions...')}
          </p>
        ) : (
          <>
            {/* Role breakdown */}
            {roleDetails.length > 0 && (
              <div className={s.roleBreakdown}>
                <h4 className={s.sectionTitle}>
                  {t('admin:groups.assignedRoles', 'Assigned Roles')}
                </h4>
                <div className={s.rolesList}>
                  {roleDetails.map(role => (
                    <div key={role.id || role.name} className={s.roleItem}>
                      <span className={s.roleName}>{role.name}</span>
                      <span className={s.rolePermCount}>
                        {t(
                          'admin:roles.permissionCount',
                          '{{count}} permission',
                          {
                            count: role.permissions.length,
                            defaultValue_other: '{{count}} permissions',
                          },
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All permissions */}
            <div className={s.permissionsSection}>
              <h4 className={s.sectionTitle}>
                <span>
                  {t(
                    'admin:groups.effectivePermissions',
                    'Effective Permissions',
                  )}
                </span>
                <span>({permissions.length})</span>
              </h4>
              {permissions.length > 0 ? (
                <div className={s.permissionsList}>
                  {permissions.map(perm => (
                    <span key={perm.id} className={s.permissionBadge}>
                      {perm.resource}:{perm.action}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={s.noPermissions}>
                  {t(
                    'admin:groups.noPermissionsAssigned',
                    'No permissions. Assign roles to grant permissions.',
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Button onClick={handleClose}>
          {t('admin:common.close', 'Close')}
        </Modal.Button>
      </Modal.Footer>
    </Modal>
  );
});

GroupPermissionsModal.displayName = 'GroupPermissionsModal';

export default GroupPermissionsModal;
