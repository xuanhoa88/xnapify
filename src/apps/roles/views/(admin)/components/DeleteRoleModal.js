/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Modal from '@shared/renderer/components/Modal';
import { deleteRole } from '../redux';

/**
 * DeleteRoleModal - Self-contained modal for deleting a role
 *
 * Usage:
 *   const deleteModalRef = useRef();
 *   deleteModalRef.current.open(role);    // Open for role
 *   deleteModalRef.current.close();       // Close modal
 */
const DeleteRoleModal = forwardRef(({ onSuccess }, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setRole(null);
    setError(null);
    setDeleting(false);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetRole => {
        setRole(targetRole);
        setError(null);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    if (!deleting) {
      resetState();
    }
  }, [deleting, resetState]);

  const handleConfirm = useCallback(async () => {
    if (!role) return;
    setDeleting(true);
    setError(null);
    try {
      await dispatch(deleteRole(role.id)).unwrap();
      resetState();
      onSuccess && onSuccess(role);
    } catch (err) {
      setError(err || t('admin:roles.deleteError', 'Failed to delete role'));
    } finally {
      setDeleting(false);
    }
  }, [dispatch, role, resetState, onSuccess, t]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('admin:roles.deleteTitle', 'Delete Role')}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:roles.deleteConfirmation',
            'Are you sure you want to delete the role "{{roleName}}"?',
            { roleName: role && role.name },
          )}
        </Modal.Description>
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button
            variant='secondary'
            onClick={handleClose}
            disabled={deleting}
          >
            {t('admin:common.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting
              ? t('admin:common.deleting', 'Deleting...')
              : t('admin:common.delete', 'Delete')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

DeleteRoleModal.displayName = 'DeleteRoleModal';

DeleteRoleModal.propTypes = {
  onSuccess: PropTypes.func,
};

export default DeleteRoleModal;
