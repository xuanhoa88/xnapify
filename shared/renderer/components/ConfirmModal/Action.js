/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Modal from '../Modal';

/**
 * ConfirmActionModal - Reusable confirmation modal for generic actions
 *
 * Usage:
 *   const actionModalRef = useRef();
 *   actionModalRef.current.open(item);    // Open with item to confirm
 *   actionModalRef.current.close();       // Close modal
 *
 * Props:
 *   @param {string} title - Modal title
 *   @param {function} getDescription - Function to build description from item
 *   @param {function} onConfirm - Async function that performs the action, receives item
 *   @param {function} onSuccess - Callback after successful action
 *   @param {string} confirmLabel - Label for the confirm button (default: "Confirm")
 *   @param {string} confirmingLabel - Label while confirming (default: "Processing...")
 *   @param {string} variant - Button variant: 'primary' | 'danger' (default: 'primary')
 */
const ConfirmActionModal = forwardRef(
  (
    {
      title,
      getDescription,
      onConfirm,
      onSuccess,
      confirmLabel,
      confirmingLabel,
      variant = 'primary',
    },
    ref,
  ) => {
    const { t } = useTranslation();

    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState(null);
    const [error, setError] = useState(null);
    const [confirming, setConfirming] = useState(false);

    const resetState = useCallback(() => {
      setIsOpen(false);
      setItem(null);
      setError(null);
      setConfirming(false);
    }, []);

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
      if (!confirming) {
        resetState();
      }
    }, [confirming, resetState]);

    const handleConfirm = useCallback(async () => {
      if (!item) return;
      setConfirming(true);
      setError(null);

      try {
        const result = await onConfirm(item);
        setConfirming(false);

        if (result && result.success === false) {
          setError(
            result.error ||
              t(
                'shared:components.confirmModal.action.error.failed',
                'Action failed',
              ),
          );
        } else {
          resetState();
          onSuccess && onSuccess(item);
        }
      } catch (err) {
        setConfirming(false);
        setError(
          err.message ||
            t(
              'shared:components.confirmModal.action.error.occurred',
              'An error occurred',
            ),
        );
      }
    }, [item, onConfirm, resetState, onSuccess, t]);

    const description = item && getDescription ? getDescription(item) : '';
    const defaultConfirmLabel = t(
      'shared:components.confirmModal.action.confirm',
      'Confirm',
    );
    const defaultConfirmingLabel = t(
      'shared:components.confirmModal.action.confirming',
      'Processing...',
    );

    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <Modal.Header onClose={handleClose}>{title}</Modal.Header>
        <Modal.Body error={error}>
          <Modal.Description>{description}</Modal.Description>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.Button
              variant='secondary'
              onClick={handleClose}
              disabled={confirming}
            >
              {t('shared:components.confirmModal.action.cancel', 'Cancel')}
            </Modal.Button>
            <Modal.Button
              variant={variant}
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming
                ? confirmingLabel || defaultConfirmingLabel
                : confirmLabel || defaultConfirmLabel}
            </Modal.Button>
          </Modal.Actions>
        </Modal.Footer>
      </Modal>
    );
  },
);

ConfirmActionModal.displayName = 'ConfirmActionModal';

ConfirmActionModal.propTypes = {
  title: PropTypes.string.isRequired,
  getDescription: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  confirmLabel: PropTypes.string,
  confirmingLabel: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'danger']),
};

export default ConfirmActionModal;
