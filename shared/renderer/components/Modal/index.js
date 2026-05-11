/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Cross2Icon } from '@radix-ui/react-icons';
import { Button, Dialog, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ConfirmAction from './ConfirmAction.js';
import ConfirmBack from './ConfirmBack.js';
import ConfirmDelete from './ConfirmDelete.js';
import ConfirmPrompt from './ConfirmPrompt.js';

import s from './Modal.css';
/**
 * Modal - Reusable modal component backed by Radix Themes Dialog
 *
 * Usage:
 *   <Modal isOpen={isOpen} onClose={handleClose}>
 *     <Modal.Header onClose={handleClose}>My Modal</Modal.Header>
 *     <Modal.Body>
 *       <p>Modal content here</p>
 *     </Modal.Body>
 *     <Modal.Footer>
 *       <Modal.Button variant="primary">Save</Modal.Button>
 *     </Modal.Footer>
 *   </Modal>
 */

/**
 * Modal.Header
 */
const ModalHeader = ({ children, onClose, className }) => (
  <Flex align='center' justify='between' gap='3' mb='4' className={className}>
    <Dialog.Title className='m-0 shrink grow min-w-0 truncate text-lg font-semibold tracking-tight'>
      {children}
    </Dialog.Title>
    {onClose && (
      <Dialog.Close>
        <Button
          variant='ghost'
          color='gray'
          size='2'
          className='shrink-0 rounded-full hover:bg-(--gray-a3) transition-colors cursor-pointer'
          onClick={onClose}
        >
          <Cross2Icon width={18} height={18} />
        </Button>
      </Dialog.Close>
    )}
  </Flex>
);

ModalHeader.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

/**
 * Modal.Body
 */
const ModalBody = ({ children, error, className }) => (
  <div className={clsx('flex-1 overflow-y-auto min-h-0 py-2', className)}>
    {error && (
      <Flex
        gap='2'
        align='center'
        mb='4'
        p='3'
        className='bg-(--red-a2) text-(--red-11) rounded-md border border-(--red-a5)'
      >
        <Text size='2' weight='medium'>
          {error}
        </Text>
      </Flex>
    )}
    {children}
  </div>
);

ModalBody.propTypes = {
  children: PropTypes.node,
  error: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Modal.Footer
 */
const ModalFooter = ({ children, className }) => (
  <Flex
    justify='end'
    gap='3'
    pt='5'
    pb='1'
    mt='5'
    className={clsx('border-t border-(--gray-a4)', className)}
  >
    {children}
  </Flex>
);

ModalFooter.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * Modal.Description
 */
const ModalDescription = ({ children, className }) => (
  <Dialog.Description className={className}>{children}</Dialog.Description>
);

ModalDescription.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * Modal.Actions
 */
const ModalActions = ({ children, className }) => (
  <Flex
    direction={{ initial: 'column-reverse', sm: 'row' }}
    wrap='wrap'
    align={{ initial: 'stretch', sm: 'center' }}
    justify='end'
    gap='3'
    className={clsx('w-full sm:w-auto', className)}
  >
    {children}
  </Flex>
);

ModalActions.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * Modal.SelectionCount
 */
const ModalSelectionCount = ({ count, countLabel, className }) => {
  const { t } = useTranslation();

  return (
    <Text size='2' color='gray' className={className}>
      {t(countLabel || 'modal.itemSelected', {
        count,
        defaultValue_one: '{{count}} item selected',
        defaultValue_other: '{{count}} items selected',
      })}
    </Text>
  );
};

ModalSelectionCount.propTypes = {
  count: PropTypes.number.isRequired,
  countLabel: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Modal.Button
 */
const ModalButton = ({
  children,
  disabled,
  onClick,
  variant = 'secondary',
  color,
  className,
  ...props
}) => (
  <Button
    variant={variant === 'primary' ? 'solid' : 'soft'}
    color={color || (variant === 'primary' ? 'indigo' : 'gray')}
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'w-full sm:w-auto cursor-pointer transition-transform active:scale-95',
      className,
    )}
    size='2'
    {...props}
  >
    {children}
  </Button>
);

ModalButton.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  color: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

/**
 * Modal - Main wrapper using Radix Dialog
 */
const Modal = ({
  isOpen,
  onClose,
  placement = 'center',
  children,
  className,
  maxWidth,
  width,
}) => {
  const resolvedMaxWidth =
    maxWidth || (placement === 'right' ? '480px' : '500px');

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={open => !open && onClose && onClose()}
    >
      <Dialog.Content
        maxWidth={resolvedMaxWidth}
        width={width}
        aria-describedby={undefined}
        className={clsx(className, s.modalContent, {
          [s.rightPlacement]: placement === 'right',
        })}
      >
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  placement: PropTypes.oneOf(['center', 'right']),
  children: PropTypes.node,
  className: PropTypes.string,
  maxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.Description = ModalDescription;
Modal.Actions = ModalActions;
Modal.SelectionCount = ModalSelectionCount;
Modal.Button = ModalButton;

// Backwards-compatible export
export const modalStyles = {};

Modal.ConfirmAction = ConfirmAction;
Modal.ConfirmBack = ConfirmBack;
Modal.ConfirmDelete = ConfirmDelete;
Modal.ConfirmPrompt = ConfirmPrompt;

export default Modal;
