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
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../../../shared/renderer/components/Modal';
import { fetchRolePermissions, isRoleFetchPermissionsLoading } from '../redux';
import s from './RolePermissionsModal.css';

/**
 * RolePermissionsModal - Self-contained modal for viewing role permissions
 *
 * Displays all permissions assigned to the role.
 * Uses the dedicated /api/admin/roles/:id/permissions endpoint.
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(role);      // Open for role
 *   permissionsModalRef.current.close();         // Close modal
 */
const RolePermissionsModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isRoleFetchPermissionsLoading);

  // Data state
  const [permissions, setPermissions] = useState([]);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(null);

  // Fetch permissions when modal opens
  useEffect(() => {
    if (isOpen && role) {
      const loadPermissions = async () => {
        try {
          const permissions = await dispatch(
            fetchRolePermissions(role.id),
          ).unwrap();
          setPermissions(permissions || []);
        } catch (err) {
          // Silently handle error
        }
      };
      loadPermissions();
    }
  }, [dispatch, isOpen, role]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setRole(null);
    setPermissions([]);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetRole => {
        setRole(targetRole);
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
        {t('admin:roles.permissionsFor', 'Permissions for')}&nbsp;&quot;
        {(role && role.name) || t('admin:common.unknown', 'Unknown')}&quot;
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          {t(
            'admin:roles.permissionsDescription',
            'These are the permissions assigned to this role.',
          )}
        </Modal.Description>

        {loading ? (
          <p>{t('admin:common.loading', 'Loading...')}</p>
        ) : (
          <div className={s.permissionsSection}>
            <h4 className={s.sectionTitle}>
              {t('admin:roles.permissions', 'Permissions')} (
              {permissions.length})
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
                  'admin:roles.noPermissionsAssigned',
                  'No permissions assigned to this role.',
                )}
              </p>
            )}
          </div>
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

RolePermissionsModal.displayName = 'RolePermissionsModal';

export default RolePermissionsModal;
