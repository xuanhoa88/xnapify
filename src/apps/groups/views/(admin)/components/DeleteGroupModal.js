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
import Modal from '../../../../../shared/renderer/components/Modal';
import { deleteGroup } from '../redux';

/**
 * DeleteGroupModal - Self-contained modal for deleting a group
 *
 * Usage:
 *   const deleteModalRef = useRef();
 *   deleteModalRef.current.open(group);    // Open for group
 *   deleteModalRef.current.close();        // Close modal
 */
const DeleteGroupModal = forwardRef(({ onSuccess }, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setGroup(null);
    setError(null);
    setDeleting(false);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetGroup => {
        setGroup(targetGroup);
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
    if (!group) return;
    setDeleting(true);
    setError(null);
    try {
      await dispatch(deleteGroup(group.id)).unwrap();
      resetState();
      onSuccess && onSuccess(group);
    } catch (err) {
      setError(err || t('admin:groups.deleteError', 'Failed to delete group'));
    } finally {
      setDeleting(false);
    }
  }, [dispatch, group, resetState, onSuccess, t]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('admin:groups.deleteTitle', 'Delete Group')}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:groups.deleteConfirmation',
            'Are you sure you want to delete the group "{{groupName}}"? This action cannot be undone.',
            { groupName: group && group.name },
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

DeleteGroupModal.displayName = 'DeleteGroupModal';

DeleteGroupModal.propTypes = {
  onSuccess: PropTypes.func,
};

export default DeleteGroupModal;
