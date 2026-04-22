/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Button, Dialog, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

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
  <Flex align='center' justify='between' mb='4' className={className}>
    <Dialog.Title>{children}</Dialog.Title>
    {onClose && (
      <Dialog.Close>
        <Button variant='ghost' color='gray' size='1' onClick={onClose}>
          ×
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
  <div className={className}>
    {error && (
      <Text size='2' color='red' weight='medium' mb='3' as='div'>
        {error}
      </Text>
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
  <Flex justify='end' gap='2' mt='4' className={className}>
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
  <Flex wrap='wrap' align='center' justify='end' gap='2' className={className}>
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
  ...props
}) => (
  <Button
    variant={variant === 'primary' ? 'solid' : 'outline'}
    color={variant === 'primary' ? 'indigo' : 'gray'}
    onClick={onClick}
    disabled={disabled}
    {...props}
  >
    {children}
  </Button>
);

ModalButton.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'secondary']),
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
}) => {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={open => !open && onClose && onClose()}
    >
      <Dialog.Content
        className={clsx(className, {
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

import ConfirmAction from './ConfirmAction';
import ConfirmBack from './ConfirmBack';
import ConfirmDelete from './ConfirmDelete';
import ConfirmPrompt from './ConfirmPrompt';

import s from './Modal.css';

Modal.ConfirmAction = ConfirmAction;
Modal.ConfirmBack = ConfirmBack;
Modal.ConfirmDelete = ConfirmDelete;
Modal.ConfirmPrompt = ConfirmPrompt;

export default Modal;
