/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Modal from '../../../../../../shared/renderer/components/Modal';
import { bulkUpdateUserStatus } from '../redux';
import { getUserProfile } from '../../../../../../shared/renderer/redux';

/**
 * ChangeStatusUserModal - Self-contained modal for changing user status
 *
 * Usage:
 *   const changeStatusModalRef = useRef();
 *   changeStatusModalRef.current.open({ ids: [...], isActive: true });
 *   changeStatusModalRef.current.close();
 */
const ChangeStatusUserModal = forwardRef(({ onSuccess }, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUser = useSelector(getUserProfile);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setData(null);
    setError(null);
    setProcessing(false);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetData => {
        if (!targetData || !Array.isArray(targetData.ids)) return;
        setData(targetData);
        setError(null);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    if (!processing) {
      resetState();
    }
  }, [processing, resetState]);

  const handleConfirm = useCallback(async () => {
    if (!data) return;

    // Filter out current user's ID to prevent self-status change (especially deactivation)
    const idsToUpdate = currentUser
      ? data.ids.filter(id => id !== currentUser.id)
      : data.ids;

    if (idsToUpdate.length === 0) {
      setError(
        t(
          'admin:users.errors.cannotChangeSelfStatus',
          'You cannot change your own account status.',
        ),
      );
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      await dispatch(
        bulkUpdateUserStatus({ ids: idsToUpdate, isActive: data.isActive }),
      ).unwrap();
      resetState();
      onSuccess && onSuccess({ ...data, ids: idsToUpdate });
    } catch (err) {
      setError(err);
    } finally {
      setProcessing(false);
    }
  }, [dispatch, data, resetState, onSuccess, currentUser, t]);

  const count = data && data.ids ? data.ids.length : 0;
  const isActive = data && data.isActive;

  // Dynamic text based on action
  const actionText = isActive
    ? t('admin:users.list.activateText', 'activate')
    : t('admin:users.list.deactivateText', 'deactivate');
  const buttonText = isActive
    ? t('admin:users.list.activate', 'Activate')
    : t('admin:users.list.deactivate', 'Deactivate');
  const processingText = isActive
    ? t('admin:users.list.activating', 'Activating...')
    : t('admin:users.list.deactivating', 'Deactivating...');

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('admin:users.list.changeStatusHeader', 'Change User Status')}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:users.list.changeStatusConfirm',
            'Are you sure you want to {{action}} {{count}} user(s)?',
            { action: actionText, count },
          )}
        </Modal.Description>
        {currentUser &&
          data &&
          data.ids &&
          data.ids.includes(currentUser.id) && (
            <Modal.Description>
              <strong>{t('admin:users.list.note', 'Note:')}</strong>
              {t(
                'admin:users.list.excludeSelfStatus',
                'Your own account will be excluded from this action.',
              )}
            </Modal.Description>
          )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button
            variant='secondary'
            onClick={handleClose}
            disabled={processing}
          >
            {t('admin:users.list.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleConfirm}
            disabled={processing}
          >
            {processing ? processingText : buttonText}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

ChangeStatusUserModal.displayName = 'ChangeStatusUserModal';

ChangeStatusUserModal.propTypes = {
  onSuccess: PropTypes.func,
};

export default ChangeStatusUserModal;
