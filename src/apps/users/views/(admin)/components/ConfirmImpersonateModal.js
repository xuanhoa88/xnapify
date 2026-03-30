/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Modal from '@shared/renderer/components/Modal';

/**
 * ConfirmImpersonateModal - Confirmation modal for impersonating a user
 *
 * Usage:
 *   const impersonateModalRef = useRef();
 *   impersonateModalRef.current.open(user);   // Open with target user
 *   impersonateModalRef.current.close();      // Close modal
 *
 * Props:
 *   @param {function} onConfirm - Async function called with the target user on confirm
 *   @param {function} onSuccess - Callback after successful impersonation
 */
const ConfirmImpersonateModal = forwardRef(({ onConfirm, onSuccess }, ref) => {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetState = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    setError(null);
    setSubmitting(false);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
        setError(null);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    if (!submitting) {
      resetState();
    }
  }, [submitting, resetState]);

  const handleConfirm = useCallback(async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      await onConfirm(user);
      setSubmitting(false);
      resetState();
      onSuccess && onSuccess(user);
    } catch (err) {
      setSubmitting(false);
      setError(
        err.message ||
          t(
            'shared:components.confirmModal.impersonate.error.occurred',
            'An error occurred',
          ),
      );
    }
  }, [user, onConfirm, resetState, onSuccess, t]);

  const displayName =
    user && ((user.profile && user.profile.display_name) || user.email || '');

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t(
          'shared:components.confirmModal.impersonate.title',
          'Confirm Impersonation',
        )}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'shared:components.confirmModal.impersonate.description',
            'You are about to impersonate "{{name}}". You will be logged in as this user and can perform actions on their behalf. Click "Impersonate" to proceed.',
            { name: displayName },
          )}
        </Modal.Description>
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button
            variant='secondary'
            onClick={handleClose}
            disabled={submitting}
          >
            {t('shared:components.confirmModal.impersonate.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting
              ? t(
                  'shared:components.confirmModal.impersonate.submitting',
                  'Switching...',
                )
              : t(
                  'shared:components.confirmModal.impersonate.confirm',
                  'Impersonate',
                )}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

ConfirmImpersonateModal.displayName = 'ConfirmImpersonateModal';

ConfirmImpersonateModal.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default ConfirmImpersonateModal;
