/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import Modal from '../../../../components/Modal';
import { bulkDeletePermissions } from '../../../../redux';

/**
 * DeletePermissionModal - Self-contained modal for deleting a permission
 *
 * Usage:
 *   const deleteModalRef = useRef();
 *   deleteModalRef.current.open(permission);    // Open for permission
 *   deleteModalRef.current.close();             // Close modal
 */
const DeletePermissionModal = forwardRef(({ onSuccess }, ref) => {
  const dispatch = useDispatch();

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setPermission(null);
    setError(null);
    setDeleting(false);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetPermission => {
        setPermission(targetPermission);
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
    if (!permission) return;
    setDeleting(true);
    setError(null);
    try {
      await dispatch(bulkDeletePermissions([permission.id])).unwrap();
      resetState();
      onSuccess && onSuccess(permission);
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(false);
    }
  }, [dispatch, permission, resetState, onSuccess]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>Delete Permission</Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          Are you sure you want to delete the permission &quot;
          {permission && `${permission.resource}:${permission.action}`}
          &quot;? This action cannot be undone.
        </Modal.Description>
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button
            variant='secondary'
            onClick={handleClose}
            disabled={deleting}
          >
            Cancel
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

DeletePermissionModal.displayName = 'DeletePermissionModal';

DeletePermissionModal.propTypes = {
  onSuccess: PropTypes.func,
};

export default DeletePermissionModal;
