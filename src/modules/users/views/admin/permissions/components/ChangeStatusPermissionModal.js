/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import Modal from '../../../../../../components/Modal';
import { bulkUpdatePermissionStatus } from '../redux';

/**
 * ChangeStatusPermissionModal - Self-contained modal for changing permission status
 *
 * Usage:
 *   const changeStatusModalRef = useRef();
 *   changeStatusModalRef.current.open({ ids: [...], isActive: true });
 *   changeStatusModalRef.current.close();
 */
const ChangeStatusPermissionModal = forwardRef(({ onSuccess }, ref) => {
  const dispatch = useDispatch();

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setData(null);
    setError(null);
    setProcessing(false);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetData => {
        if (!targetData || !Array.isArray(targetData.ids)) return;
        setData(targetData);
        setError(null);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    if (!processing) {
      resetState();
    }
  }, [processing, resetState]);

  const handleConfirm = useCallback(async () => {
    if (!data) return;
    setProcessing(true);
    setError(null);
    try {
      await dispatch(
        bulkUpdatePermissionStatus({ ids: data.ids, isActive: data.isActive }),
      ).unwrap();
      resetState();
      onSuccess && onSuccess(data);
    } catch (err) {
      setError(err);
    } finally {
      setProcessing(false);
    }
  }, [dispatch, data, resetState, onSuccess]);

  const count = data && data.ids ? data.ids.length : 0;
  const isActive = data && data.isActive;
  const actionText = isActive ? 'activate' : 'deactivate';
  const buttonText = isActive ? 'Activate' : 'Deactivate';
  const processingText = isActive ? 'Activating...' : 'Deactivating...';

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        Change Permission Status
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          Are you sure you want to {actionText} {count} permission(s)?
        </Modal.Description>
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button
            variant='secondary'
            onClick={handleClose}
            disabled={processing}
          >
            Cancel
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleConfirm}
            disabled={processing}
          >
            {processing ? processingText : buttonText}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

ChangeStatusPermissionModal.displayName = 'ChangeStatusPermissionModal';

ChangeStatusPermissionModal.propTypes = {
  onSuccess: PropTypes.func,
};

export default ChangeStatusPermissionModal;
