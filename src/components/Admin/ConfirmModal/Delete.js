/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Modal from '../../Modal';

/**
 * ConfirmDeleteModal - Reusable confirmation modal for delete operations
 *
 * Usage:
 *   const deleteModalRef = useRef();
 *   deleteModalRef.current.open(item);    // Open with item to delete
 *   deleteModalRef.current.close();       // Close modal
 *
 * Props:
 *   @param {string} title - Modal title (e.g., "Delete User")
 *   @param {function} getItemName - Function to get display name from item
 *   @param {function} onDelete - Async function that performs the delete, receives item
 *   @param {function} onSuccess - Callback after successful deletion
 */
const ConfirmDeleteModal = forwardRef(
  ({ title, getItemName, onDelete, onSuccess }, ref) => {
    const { t } = useTranslation();

    // Internal state
    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState(null);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Reset state helper
    const resetState = useCallback(() => {
      setIsOpen(false);
      setItem(null);
      setError(null);
      setDeleting(false);
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        open: targetItem => {
          setItem(targetItem);
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
      if (!item) return;
      setDeleting(true);
      setError(null);

      try {
        const result = await onDelete(item);
        setDeleting(false);

        if (result.success) {
          resetState();
          onSuccess && onSuccess(item);
        } else {
          setError(result.error || t('errors.delete', 'Failed to delete'));
        }
      } catch (err) {
        setDeleting(false);
        setError(err.message || t('errors.delete', 'An error occurred'));
      }
    }, [item, onDelete, resetState, onSuccess, t]);

    const itemName = item && getItemName ? getItemName(item) : '';

    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <Modal.Header onClose={handleClose}>{title}</Modal.Header>
        <Modal.Body error={error}>
          <Modal.Description>
            Are you sure you want to delete &quot;{itemName}&quot;? This action
            cannot be undone.
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
  },
);

ConfirmDeleteModal.displayName = 'ConfirmDeleteModal';

ConfirmDeleteModal.propTypes = {
  title: PropTypes.string.isRequired,
  getItemName: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default ConfirmDeleteModal;
