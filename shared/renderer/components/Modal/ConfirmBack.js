/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';

import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Modal from './index.js';

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
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth='400px'>
      <Modal.Header onClose={handleClose}>
        {t('common:components.confirmModal.back.title', 'Unsaved Changes')}
      </Modal.Header>
      <Modal.Body>
        <Flex gap='3' align='start'>
          <Box className='shrink-0 p-2 rounded-full bg-(--amber-a3) text-(--amber-11)'>
            <InfoCircledIcon width='24' height='24' />
          </Box>
          <Box className='pt-1'>
            <Modal.Description>
              <Text size='3' color='gray' className='leading-relaxed'>
                {t(
                  'common:components.confirmModal.back.description',
                  'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
                )}
              </Text>
            </Modal.Description>
          </Box>
        </Flex>
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button variant='secondary' onClick={handleClose}>
            {t('common:components.confirmModal.back.stay', 'Stay')}
          </Modal.Button>
          <Modal.Button variant='primary' color='amber' onClick={handleConfirm}>
            {t('common:components.confirmModal.back.leave', 'Leave')}
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
