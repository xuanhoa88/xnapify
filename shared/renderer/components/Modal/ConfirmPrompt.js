/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useRef,
} from 'react';

import { TextField, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Modal from './index';

import s from './ConfirmPrompt.css';

/**
 * ConfirmPromptModal - Reusable confirmation modal with a text input prompt built on Radix Themes
 *
 * Usage:
 *   const promptModalRef = useRef();
 *   promptModalRef.current.open({ title: 'New Folder', defaultValue: 'Untitled folder' });
 *
 * Props:
 *   @param {function} onSubmit - Async function that processes the input value, receives value
 *   @param {function} onSuccess - Callback after successful submission
 */
const ConfirmPromptModal = forwardRef(({ onSubmit, onSuccess }, ref) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetState = useCallback(() => {
    setIsOpen(false);
    setTitle('');
    setValue('');
    setError(null);
    setSubmitting(false);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: ({ title: initialTitle, defaultValue = '' }) => {
        setTitle(initialTitle);
        setValue(defaultValue);
        setError(null);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
        inputRef.current.select();
      }, 100);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (!submitting) {
      resetState();
    }
  }, [submitting, resetState]);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit(value.trim());

      if (result && result.success === false) {
        setSubmitting(false);
        setError(
          result.error ||
            t(
              'shared:components.confirmModal.prompt.error.failed',
              'Failed to submit',
            ),
        );
        return;
      }

      resetState();
      onSuccess && onSuccess(value.trim());
    } catch (err) {
      setSubmitting(false);
      setError(
        err.message ||
          t(
            'shared:components.confirmModal.prompt.error.occurred',
            'An error occurred',
          ),
      );
    }
  }, [value, onSubmit, resetState, onSuccess, t]);

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>{title}</Modal.Header>
      <Modal.Body error={error}>
        <Box py='2'>
          <TextField.Root
            ref={inputRef}
            type='text'
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            size='2'
            className={s.fullWidthInput}
          />
        </Box>
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button
            variant='secondary'
            onClick={handleClose}
            disabled={submitting}
          >
            {t('shared:components.confirmModal.prompt.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleConfirm}
            disabled={submitting}
          >
            {t('shared:components.confirmModal.prompt.submit', 'Create')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

ConfirmPromptModal.displayName = 'ConfirmPromptModal';

ConfirmPromptModal.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default ConfirmPromptModal;
