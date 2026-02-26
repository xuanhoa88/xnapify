/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Modal from '../../../../../shared/renderer/components/Modal';
import { bulkDeleteUsers } from '../redux';
import { getUserProfile } from '../../../../../shared/renderer/redux';

/**
 * DeleteUserModal - Self-contained modal for deleting users (single or bulk)
 *
 * Usage:
 *   const deleteModalRef = useRef();
 *   deleteModalRef.current.open({ ids: [userId], items: [user] });  // Single
 *   deleteModalRef.current.open({ ids: [...] });                    // Bulk
 *   deleteModalRef.current.close();
 */
const DeleteUserModal = forwardRef(({ onSuccess }, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUser = useSelector(getUserProfile);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setData(null);
    setError(null);
    setDeleting(false);
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
    if (!deleting) {
      resetState();
    }
  }, [deleting, resetState]);

  const handleConfirm = useCallback(async () => {
    if (!data) return;

    // Filter out current user's ID to prevent self-deletion
    const idsToDelete = currentUser
      ? data.ids.filter(id => id !== currentUser.id)
      : data.ids;

    if (idsToDelete.length === 0) {
      setError(
        t(
          'admin:users.errors.cannotDeleteSelf',
          'You cannot delete your own account.',
        ),
      );
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await dispatch(bulkDeleteUsers(idsToDelete)).unwrap();
      resetState();
      onSuccess && onSuccess({ ...data, ids: idsToDelete });
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(false);
    }
  }, [dispatch, data, resetState, onSuccess, currentUser, t]);

  // Generate display name
  const displayName = useMemo(() => {
    if (data && data.items && data.items.length === 1) {
      const user = data.items[0];
      return `"${(user.profile && user.profile.display_name) || user.email}"`;
    }
    const count = data && data.ids ? data.ids.length : 0;
    return t('admin:users.list.userCount', '{{count}} user(s)', { count });
  }, [data, t]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('admin:users.list.deleteUserHeader', 'Delete User(s)')}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:users.list.deleteUserConfirm',
            'Are you sure you want to delete {{name}}? This action cannot be undone.',
            { name: displayName },
          )}
        </Modal.Description>
        {currentUser &&
          data &&
          data.ids &&
          data.ids.includes(currentUser.id) && (
            <Modal.Description>
              <strong>{t('admin:users.list.note', 'Note:')}</strong>
              {t(
                'admin:users.list.excludeSelfDeletion',
                'Your own account will be excluded from deletion.',
              )}
            </Modal.Description>
          )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button
            variant='secondary'
            onClick={handleClose}
            disabled={deleting}
          >
            {t('admin:users.list.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting
              ? t('admin:users.list.deleting', 'Deleting...')
              : t('admin:users.list.delete', 'Delete')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

DeleteUserModal.displayName = 'DeleteUserModal';

DeleteUserModal.propTypes = {
  onSuccess: PropTypes.func,
};

export default DeleteUserModal;
