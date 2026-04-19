/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

import { Text, TextField } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { ExtensionSlot } from '../Extension';
import Modal from '../Modal';

import s from './ToolbarPromptModal.css';

// ---------------------------------------------------------------------------
// Context — allows any nested component to trigger the shared prompt modal
// ---------------------------------------------------------------------------

const ToolbarPromptContext = createContext(null);

/**
 * useToolbarPrompt — Hook to access the shared prompt modal.
 *
 * @returns {{ openPrompt: (opts: PromptOptions) => void }}
 *
 * PromptOptions:
 *   title      – Modal header text
 *   label      – Input label (optional)
 *   defaultValue – Pre-filled value
 *   slotName   – ExtensionSlot name for customisation
 *   onSubmit   – Callback receiving the trimmed input value
 */
export function useToolbarPrompt() {
  const ctx = useContext(ToolbarPromptContext);
  if (!ctx) {
    throw new Error(
      'useToolbarPrompt must be used within a <ToolbarPromptProvider>',
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider + Modal
// ---------------------------------------------------------------------------

export function ToolbarPromptProvider({ editor, children }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  // Prompt state
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [slotName, setSlotName] = useState('');
  const onSubmitRef = useRef(null);

  // Open the modal with given options
  const openPrompt = useCallback(opts => {
    setTitle(opts.title || '');
    setLabel(opts.label || '');
    setValue(opts.defaultValue || '');
    setSlotName(opts.slotName || '');
    onSubmitRef.current = opts.onSubmit || null;
    setIsOpen(true);
  }, []);

  // Close & reset
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTitle('');
    setLabel('');
    setValue('');
    setSlotName('');
    onSubmitRef.current = null;
  }, []);

  // Submit
  const handleConfirm = useCallback(() => {
    const trimmed = value.trim();
    if (onSubmitRef.current) {
      onSubmitRef.current(trimmed);
    }
    handleClose();
  }, [value, handleClose]);

  // Enter key submits
  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    },
    [handleConfirm],
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

  return (
    <ToolbarPromptContext.Provider value={{ openPrompt }}>
      {children}

      <Modal isOpen={isOpen} onClose={handleClose}>
        <Modal.Header onClose={handleClose}>{title}</Modal.Header>
        <Modal.Body>
          {/* ExtensionSlot: extensions can replace the default input */}
          {slotName && (
            <ExtensionSlot
              name={slotName}
              editor={editor}
              value={value}
              onChange={setValue}
            />
          )}

          {/* Default text input (always rendered; extension can visually hide) */}
          <div className={s.inputContainer}>
            {label && (
              <Text as='label' className={s.inputLabel}>
                {label}
              </Text>
            )}
            <TextField.Root
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={label || title}
              size='3'
            >
              <TextField.Input />
            </TextField.Root>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.Button variant='secondary' onClick={handleClose}>
              {t('shared:components.toolbarPrompt.cancel', 'Cancel')}
            </Modal.Button>
            <Modal.Button variant='primary' onClick={handleConfirm}>
              {t('shared:components.toolbarPrompt.confirm', 'OK')}
            </Modal.Button>
          </Modal.Actions>
        </Modal.Footer>
      </Modal>
    </ToolbarPromptContext.Provider>
  );
}

ToolbarPromptProvider.propTypes = {
  editor: PropTypes.object,
  children: PropTypes.node.isRequired,
};
