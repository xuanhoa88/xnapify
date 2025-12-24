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
import { useDispatch } from 'react-redux';
import { Modal } from '../../../../components/Modal';
import { fetchRoleById } from '../../../../redux';
import s from './RolePermissionsModal.css';

/**
 * RolePermissionsModal - Self-contained modal for viewing role permissions
 *
 * Displays all permissions assigned to the role.
 *
 * Usage:
 *   const permissionsModalRef = useRef();
 *   permissionsModalRef.current.open(role);      // Open for role
 *   permissionsModalRef.current.close();         // Close modal
 */
const RolePermissionsModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Loading and data state
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(null);

  // Fetch permissions when modal opens
  useEffect(() => {
    if (isOpen && role) {
      const loadPermissions = async () => {
        setLoading(true);
        const result = await dispatch(fetchRoleById(role.id));
        if (result.success && result.role) {
          setPermissions(result.role.permissions || []);
        }
        setLoading(false);
      };
      loadPermissions();
    }
  }, [dispatch, isOpen, role]);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setRole(null);
    setPermissions([]);
    setLoading(false);
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
        {t('roles.permissionsFor', 'Permissions for')}&nbsp;&quot;
        {(role && role.name) || t('common.unknown', 'Unknown')}&quot;
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          {t(
            'roles.permissionsDescription',
            'These are the permissions assigned to this role.',
          )}
        </Modal.Description>

        {loading ? (
          <p>{t('common.loading', 'Loading...')}</p>
        ) : (
          <div className={s.permissionsSection}>
            <h4 className={s.sectionTitle}>
              {t('roles.permissions', 'Permissions')} ({permissions.length})
            </h4>
            {permissions.length > 0 ? (
              <div className={s.permissionsList}>
                {permissions.map(perm => (
                  <span key={perm.id} className={s.permissionBadge}>
                    {`${perm.resource}:${perm.action}`}
                  </span>
                ))}
              </div>
            ) : (
              <p className={s.noPermissions}>
                {t(
                  'roles.noPermissionsAssigned',
                  'No permissions assigned to this role.',
                )}
              </p>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Button onClick={handleClose}>
          {t('common.close', 'Close')}
        </Modal.Button>
      </Modal.Footer>
    </Modal>
  );
});

RolePermissionsModal.displayName = 'RolePermissionsModal';

export default RolePermissionsModal;
