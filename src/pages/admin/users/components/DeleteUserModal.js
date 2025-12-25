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
import { deleteUser } from '../../../../redux';

/**
 * DeleteUserModal - Self-contained modal for deleting a user
 *
 * Usage:
 *   const deleteModalRef = useRef();
 *   deleteModalRef.current.open(user);    // Open for user
 *   deleteModalRef.current.close();       // Close modal
 */
const DeleteUserModal = forwardRef(({ onSuccess }, ref) => {
  const dispatch = useDispatch();

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    setError(null);
    setDeleting(false);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
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
    if (!user) return;
    setDeleting(true);
    setError(null);
    const result = await dispatch(deleteUser(user.id));
    setDeleting(false);
    if (result.success) {
      resetState();
      // Call success callback if provided
      onSuccess && onSuccess(user);
    } else {
      setError(result.error);
    }
  }, [dispatch, user, resetState, onSuccess]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>Delete User</Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          Are you sure you want to delete the user &quot;
          {user && (user.display_name || user.email)}&quot;? This action cannot
          be undone.
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

DeleteUserModal.displayName = 'DeleteUserModal';

DeleteUserModal.propTypes = {
  onSuccess: PropTypes.func,
};

export default DeleteUserModal;
