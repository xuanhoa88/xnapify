/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import Button from '../Button';

import s from './Modal.css';

/**
 * Modal - Reusable modal component with composable sub-components
 *
 * Usage:
 *   <Modal isOpen={isOpen} onClose={handleClose}>
 *     <Modal.Header onClose={handleClose}>My Modal</Modal.Header>
 *     <Modal.Body>
 *       <p>Modal content here</p>
 *     </Modal.Body>
 *     <Modal.Footer>
 *       <button>Save</button>
 *     </Modal.Footer>
 *   </Modal>
 */

/**
 * Modal.Header - Modal header with title and close button
 * @param {React.ReactNode} children - Modal title text
 * @param {function} onClose - Close button click handler
 */
const ModalHeader = ({ children, onClose, className }) => (
  <div className={clsx(s.modalHeader, className)}>
    <h3 className={s.modalTitle}>{children}</h3>
    {onClose && (
      <Button
        variant='unstyled'
        iconOnly
        className={s.modalClose}
        onClick={onClose}
      >
        ×
      </Button>
    )}
  </div>
);

ModalHeader.propTypes = {
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

/**
 * Modal.Body - Modal body container
 * @param {React.ReactNode} children - Body content
 * @param {string} error - Optional error message to display
 */
const ModalBody = ({ children, error, className }) => (
  <div className={clsx(s.modalBody, className)}>
    {error && <div className={s.modalError}>{error}</div>}
    {children}
  </div>
);

ModalBody.propTypes = {
  children: PropTypes.node.isRequired,
  error: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Modal.Footer - Modal footer container
 * @param {React.ReactNode} children - Footer content
 */
const ModalFooter = ({ children, className }) => (
  <div className={clsx(s.modalFooter, className)}>{children}</div>
);

ModalFooter.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Modal.Description - Optional description text
 * @param {React.ReactNode} children - Description content
 */
const ModalDescription = ({ children, className }) => (
  <p className={clsx(s.modalDescription, className)}>{children}</p>
);

ModalDescription.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Modal.Actions - Footer actions container
 * @param {React.ReactNode} children - Action buttons
 */
const ModalActions = ({ children, className }) => (
  <div className={clsx(s.modalActions, className)}>{children}</div>
);

ModalActions.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Modal.SelectionCount - Selection count display with i18n support
 * @param {number} count - Number of selected items
 * @param {string} countLabel - i18n key for the selection message (e.g., "users.selected")
 */
const ModalSelectionCount = ({ count, countLabel, className }) => {
  const { t } = useTranslation();

  return (
    <span className={clsx(s.selectionCount, className)}>
      {t(countLabel || 'modal.itemSelected', {
        count,
        defaultValue_one: '{{count}} item selected',
        defaultValue_other: '{{count}} items selected',
      })}
    </span>
  );
};

ModalSelectionCount.propTypes = {
  count: PropTypes.number.isRequired,
  countLabel: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Modal.Button - Styled modal button
 * @param {React.ReactNode} children - Button content
 * @param {string} variant - Button style variant ('primary' | 'secondary')
 * @param {boolean} disabled - Whether button is disabled
 * @param {function} onClick - Click handler
 * @param {string} type - Button type attribute
 */
const ModalButton = ({
  children,
  disabled,
  onClick,
  variant = 'secondary',
  ...props
}) => (
  <Button
    variant={variant}
    className={clsx(
      s.modalBtn,
      variant === 'primary' ? s.modalBtnPrimary : s.modalBtnSecondary,
    )}
    onClick={onClick}
    disabled={disabled}
    {...props}
  >
    {children}
  </Button>
);

ModalButton.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

/**
 * Modal - Main modal wrapper
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler called when overlay is clicked
 * @param {string} placement - Modal placement ('center' | 'right')
 * @param {React.ReactNode} children - Modal content (Header, Body, Footer)
 */
const Modal = ({
  isOpen,
  onClose,
  placement = 'center',
  children,
  className,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    let timer;
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300); // 300ms matches animation duration
    }
    return () => clearTimeout(timer);
  }, [isOpen, shouldRender]);

  if (!shouldRender || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={clsx(
        s.modalOverlay,
        {
          [s.modalOverlayRight]: placement === 'right',
          [s.modalOverlayClosing]: isClosing,
        },
        className,
      )}
      onClick={onClose}
      role='presentation'
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className={clsx(s.modal, {
          [s.modalRight]: placement === 'right',
          [s.modalClosing]: isClosing && placement !== 'right',
          [s.modalRightClosing]: isClosing && placement === 'right',
        })}
        role='dialog'
        aria-modal='true'
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  placement: PropTypes.oneOf(['center', 'right']),
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

// Attach sub-components
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.Description = ModalDescription;
Modal.Actions = ModalActions;
Modal.SelectionCount = ModalSelectionCount;
Modal.Button = ModalButton;

export default Modal;
