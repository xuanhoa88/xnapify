/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';

import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Modal from './index.js';

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
      onDelete(item);
      onSuccess && onSuccess(item);
    }, [item, onDelete, resetState, onSuccess]);

    const itemName = item && getItemName ? getItemName(item) : '';

    return (
      <Modal isOpen={isOpen} onClose={resetState} maxWidth='400px'>
        <Modal.Header onClose={resetState}>{title}</Modal.Header>
        <Modal.Body>
          <Flex gap='3' align='start'>
            <Box className='shrink-0 p-2 rounded-full bg-(--red-a3) text-(--red-11)'>
              <ExclamationTriangleIcon width='24' height='24' />
            </Box>
            <Box className='pt-1'>
              <Modal.Description>
                <Text size='3' color='gray' className='leading-relaxed'>
                  {t(
                    'common:components.confirmModal.delete.description',
                    'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
                    { name: itemName },
                  )}
                </Text>
              </Modal.Description>
            </Box>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.Button variant='secondary' onClick={resetState}>
              {t('common:components.confirmModal.delete.cancel', 'Cancel')}
            </Modal.Button>
            <Modal.Button variant='primary' color='red' onClick={handleConfirm}>
              {t('common:components.confirmModal.delete.delete', 'Delete')}
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
