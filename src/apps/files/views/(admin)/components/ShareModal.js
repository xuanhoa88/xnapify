/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Icon } from '../../../../../shared/renderer/components/Admin';
import Modal from '../../../../../shared/renderer/components/Modal';
import Button from '../../../../../shared/renderer/components/Button';
import { validateForm } from '../../../../../shared/validator';
import { shareFileFormSchema } from '../../../validator/admin/file';
import { updateSharing } from '../redux';
import s from './ShareModal.css';

const ShareModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [shareType, setShareType] = useState('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resetState = useCallback(() => {
    setIsOpen(false);
    setFile(null);
    setShareType('private');
    setLoading(false);
    setError(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: targetFile => {
        setFile(targetFile);
        setShareType(targetFile.share_type || 'private');
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = () => {
    if (!loading) {
      resetState();
    }
  };

  if (!isOpen || !file) return null;

  const handleSave = async () => {
    const [isValid, errors] = validateForm(shareFileFormSchema, { shareType });

    if (!isValid) {
      setError(
        (errors.shareType && errors.shareType[0]) ||
          t('files:share.invalid_type', 'Invalid share type'),
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await dispatch(updateSharing({ id: file.id, shareType })).unwrap();
      handleClose();
    } catch (e) {
      setError(
        e.message || t('files:share.save_failed', 'Failed to save settings'),
      );
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/api/admin/files/${file.id}/download`;
    navigator.clipboard.writeText(link);
    alert(t('files:share.link_copied', 'Link copied to clipboard!'));
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('files:share.title', { name: file.name })}
      </Modal.Header>

      <Modal.Body error={error}>
        <div className={s.section}>
          <h4>{t('files:share.general_access', 'General access')}</h4>
          <div className={s.accessRow}>
            <div className={s.accessIcon}>
              {shareType === 'private' ? (
                <Icon name='lock' size={24} className={s.restrictedIcon} />
              ) : (
                <Icon name='globe' size={24} className={s.publicIcon} />
              )}
            </div>
            <div className={s.accessSelectBlock}>
              <select
                className={s.accessSelect}
                value={shareType}
                onChange={e => setShareType(e.target.value)}
              >
                <option value='private'>
                  {t('files:share.restricted', 'Restricted')}
                </option>
                <option value='public_link'>
                  {t('files:share.public_link', 'Anyone with the link')}
                </option>
                <option value='shared_users'>
                  {t('files:share.specific_users', 'Specific Users')}
                </option>
              </select>
              <p className={s.accessHelper}>
                {shareType === 'private'
                  ? t(
                      'files:share.restricted_desc',
                      'Only people with access can open with the link',
                    )
                  : shareType === 'public_link'
                    ? t(
                        'files:share.public_link_desc',
                        'Anyone on the internet with this link can view',
                      )
                    : t(
                        'files:share.specific_users_desc',
                        'Only specific users you add below can access',
                      )}
              </p>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Modal.Actions>
          <Button variant='outline' size='small' onClick={copyLink}>
            {t('files:share.copy_link', 'Copy link')}
          </Button>
          <div className={s.spacer} />
          <Button variant='primary' onClick={handleSave} loading={loading}>
            {t('files:share.done', 'Done')}
          </Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

ShareModal.displayName = 'ShareModal';

ShareModal.propTypes = {};

export default ShareModal;
