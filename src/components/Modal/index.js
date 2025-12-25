/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';
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
const ModalHeader = ({ children, onClose }) => (
  <div className={s.modalHeader}>
    <h3 className={s.modalTitle}>{children}</h3>
    {onClose && (
      <Button
        variant='ghost'
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
};

/**
 * Modal.Body - Modal body container
 * @param {React.ReactNode} children - Body content
 * @param {string} error - Optional error message to display
 */
const ModalBody = ({ children, error }) => (
  <div className={s.modalBody}>
    {error && <div className={s.modalError}>{error}</div>}
    {children}
  </div>
);

ModalBody.propTypes = {
  children: PropTypes.node.isRequired,
  error: PropTypes.string,
};

/**
 * Modal.Footer - Modal footer container
 * @param {React.ReactNode} children - Footer content
 */
const ModalFooter = ({ children }) => (
  <div className={s.modalFooter}>{children}</div>
);

ModalFooter.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Modal.Description - Optional description text
 * @param {React.ReactNode} children - Description content
 */
const ModalDescription = ({ children }) => (
  <p className={s.modalDescription}>{children}</p>
);

ModalDescription.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Modal.Actions - Footer actions container
 * @param {React.ReactNode} children - Action buttons
 */
const ModalActions = ({ children }) => (
  <div className={s.modalActions}>{children}</div>
);

ModalActions.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Modal.SelectionCount - Selection count display
 * @param {number} count - Number of selected items
 * @param {string} singular - Singular label (e.g., "item")
 * @param {string} plural - Plural label (e.g., "items")
 */
const ModalSelectionCount = ({ count, singular, plural }) => (
  <span className={s.selectionCount}>
    {count} {count !== 1 ? plural : singular} selected
  </span>
);

ModalSelectionCount.propTypes = {
  count: PropTypes.number.isRequired,
  singular: PropTypes.string.isRequired,
  plural: PropTypes.string.isRequired,
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
}) => (
  <Button
    variant={variant}
    className={clsx(
      s.modalBtn,
      variant === 'primary' ? s.modalBtnPrimary : s.modalBtnSecondary,
    )}
    onClick={onClick}
    disabled={disabled}
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
 * @param {React.ReactNode} children - Modal content (Header, Body, Footer)
 */
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className={s.modalOverlay} onClick={onClose} role='presentation'>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className={s.modal}
        role='dialog'
        aria-modal='true'
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
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
