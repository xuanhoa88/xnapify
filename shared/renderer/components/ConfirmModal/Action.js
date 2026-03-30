/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
      variant = 'primary',
    },
    ref,
  ) => {
    const { t } = useTranslation();

    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState(null);

    const resetState = useCallback(() => {
      setIsOpen(false);
      setItem(null);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        open: targetItem => {
          setItem(targetItem);
          setIsOpen(true);
        },
        close: resetState,
      }),
      [resetState],
    );

    const handleConfirm = useCallback(() => {
      if (!item) return;
      resetState();
      onConfirm(item);
      onSuccess && onSuccess(item);
    }, [item, onConfirm, resetState, onSuccess]);

    const description = item && getDescription ? getDescription(item) : '';
    const defaultConfirmLabel = t(
      'shared:components.confirmModal.action.confirm',
      'Confirm',
    );

    return (
      <Modal isOpen={isOpen} onClose={resetState}>
        <Modal.Header onClose={resetState}>{title}</Modal.Header>
        <Modal.Body>
          <Modal.Description>{description}</Modal.Description>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.Button variant='secondary' onClick={resetState}>
              {t('shared:components.confirmModal.action.cancel', 'Cancel')}
            </Modal.Button>
            <Modal.Button variant={variant} onClick={handleConfirm}>
              {confirmLabel || defaultConfirmLabel}
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
  variant: PropTypes.oneOf(['primary', 'danger']),
};

export default ConfirmActionModal;
