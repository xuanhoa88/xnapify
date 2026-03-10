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
 * ConfirmBackModal - Confirmation modal for navigating back from forms
 *
 * Usage:
 *   const confirmBackModalRef = useRef();
 *   confirmBackModalRef.current.open();    // Open modal
 *   confirmBackModalRef.current.close();   // Close modal
 */
const ConfirmBackModal = forwardRef(({ onConfirm }, ref) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    onConfirm && onConfirm();
  }, [onConfirm]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('shared:components.confirmModal.back.title', 'Unsaved Changes')}
      </Modal.Header>
      <Modal.Body>
        <Modal.Description>
          {t(
            'shared:components.confirmModal.back.description',
            'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
          )}
        </Modal.Description>
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button variant='secondary' onClick={handleClose}>
            {t('shared:components.confirmModal.back.stay', 'Stay')}
          </Modal.Button>
          <Modal.Button variant='primary' onClick={handleConfirm}>
            {t('shared:components.confirmModal.back.leave', 'Leave')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

ConfirmBackModal.displayName = 'ConfirmBackModal';

ConfirmBackModal.propTypes = {
  onConfirm: PropTypes.func.isRequired,
};

export default ConfirmBackModal;
