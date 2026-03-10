/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { getUserId } from '@shared/renderer/redux/features/user/selector';
import Icon from '@shared/renderer/components/Icon';
import Modal from '@shared/renderer/components/Modal';
import Button from '@shared/renderer/components/Button';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import { validateForm } from '@shared/validator';
import { shareFileFormSchema } from '../../../validator/admin/file';
import { updateSharing, fetchFileShares, searchUsersAndGroups } from '../redux';
import s from './ShareModal.css';

const ShareModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUserId = useSelector(getUserId);
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [shareType, setShareType] = useState('private');
  const [shares, setShares] = useState(/** @type {any[]} */ ([]));
  const [fileOwner, setFileOwner] = useState(null);
  const [searchResults, setSearchResults] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [initError, setInitError] = useState(null);

  const resetState = useCallback(() => {
    setIsOpen(false);
    setFile(null);
    setShareType('private');
    setShares([]);
    setFileOwner(null);
    setSearchResults([]);
    setLoading(false);
    setSearching(false);
    setError(null);
    setInitError(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: async targetFile => {
        setFile(targetFile);
        setShareType(targetFile.share_type || 'private');
        setIsOpen(true);
        setLoading(true);
        try {
          const data = await dispatch(fetchFileShares(targetFile.id)).unwrap();
          setShares(data.shares || []);
          setFileOwner(data.owner || targetFile.owner || null);
        } catch (e) {
          let errorMessage = t(
            'files:share.load_failed',
            'Failed to load permissions',
          );
          if (
            e.status === 403 ||
            (e.message && e.message.includes('Permission denied'))
          ) {
            errorMessage = t(
              'files:share.no_permission',
              "You don't have permission to manage sharing for this file.",
            );
          }
          setInitError(errorMessage);
        } finally {
          setLoading(false);
        }
      },
      close: resetState,
    }),
    [dispatch, resetState, t],
  );

  const handleClose = useCallback(() => {
    if (!loading) {
      resetState();
    }
  }, [loading, resetState]);

  const handleSearch = useCallback(
    async term => {
      if (!term || term.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const { results } = await dispatch(searchUsersAndGroups(term)).unwrap();

        const options = (results || [])
          .filter(r => {
            const isUser =
              r.entityType === 'user' || r.entityType === 'users:user';
            if (isUser && r.entityId === currentUserId) {
              return false; // prevent sharing with self
            }
            return true;
          })
          .map(r => {
            const isGroup =
              r.entityType === 'group' || r.entityType === 'groups:group';
            return {
              value: `${isGroup ? 'group' : 'user'}:${r.entityId}`,
              label: r.title,
              type: isGroup ? 'group' : 'user',
              data: r,
            };
          });

        setSearchResults(options);
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setSearching(false);
      }
    },
    [dispatch, currentUserId],
  );

  const renderSearchResult = useCallback(
    option => {
      const isGroup = option.type === 'group';
      const r = option.data;

      // Use profile data if available, otherwise email/name
      let primaryName = option.label;
      let secondaryName = isGroup
        ? t('files:share.group', 'Group')
        : r.email || t('files:share.user', 'User');

      return (
        <div className={s.searchResultItem}>
          <div
            className={clsx(s.avatar, s.smallAvatar, {
              [s.groupAvatar]: isGroup,
            })}
          >
            <Icon name={isGroup ? 'users' : 'user'} size={14} />
          </div>
          <div className={s.shareInfo}>
            <span className={s.shareName}>{primaryName}</span>
            <span className={s.shareRole}>{secondaryName}</span>
          </div>
        </div>
      );
    },
    [t],
  );

  const handleAddShare = useCallback(
    selectedValue => {
      if (!selectedValue) return;

      const [type, id] = selectedValue.split(':');
      const option = searchResults.find(r => r.value === selectedValue);

      if (!option) return;

      // Check if already added
      const exists = shares.find(
        share => share.entity_type === type && share.entity_id === id,
      );

      if (exists) return;

      // Prevent adding the file owner as a share recipient
      if (type === 'user' && file && id === file.owner_id) return;

      const newShare = {
        entity_id: id,
        entity_type: type,
        permission: 'viewer',
        isNew: true,
        user: type === 'user' ? { email: option.label } : null,
        group: type === 'group' ? { name: option.label } : null,
      };

      setShares(prev => [...prev, newShare]);
      setShareType('shared_users');
    },
    [searchResults, shares, file],
  );

  const handleRemoveShare = useCallback(index => {
    setShares(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handlePermissionChange = useCallback((index, permission) => {
    setShares(prev => {
      const next = [...prev];
      next[index] = { ...next[index], permission };
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const payload = {
      shareType,
      shares: shares.map(share => ({
        entityId: share.entity_id,
        entityType: share.entity_type,
        permission: share.permission,
      })),
    };

    const [isValid, errors] = validateForm(shareFileFormSchema, payload);

    if (!isValid) {
      setError(
        (errors.shareType && errors.shareType[0]) ||
          t('files:share.invalid_type', 'Invalid share settings'),
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await dispatch(updateSharing({ id: file.id, ...payload })).unwrap();
      handleClose();
    } catch (e) {
      setError(
        e.message || t('files:share.save_failed', 'Failed to save settings'),
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch, file, handleClose, shareType, shares, t]);

  const copyLink = useCallback(() => {
    const link = `${window.location.origin}/api/files/${file.id}/download`;
    navigator.clipboard.writeText(link);
    alert(t('files:share.link_copied', 'Link copied to clipboard!'));
  }, [file, t]);

  if (!isOpen || !file) return null;

  const isOwner = file.owner_id === currentUserId;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {t('files:share.title', { name: file.name })}
      </Modal.Header>

      <Modal.Body
        error={error}
        loading={loading && !shares.length && !initError}
      >
        {initError ? (
          <div className={s.initErrorState}>
            <div className={s.initErrorIcon}>
              <Icon name='lock' size={48} />
            </div>
            <p className={s.initErrorMessage}>{initError}</p>
          </div>
        ) : (
          <>
            <div className={s.section}>
              <h4>{t('files:share.general_access', 'General access')}</h4>
              <div className={s.accessRow}>
                <div className={s.accessIcon}>
                  {shareType === 'private' ? (
                    <Icon name='lock' size={24} className={s.restrictedIcon} />
                  ) : shareType === 'shared_users' ? (
                    <Icon name='users' size={24} className={s.usersIcon} />
                  ) : (
                    <Icon name='globe' size={24} className={s.publicIcon} />
                  )}
                </div>
                <div className={s.accessSelectBlock}>
                  <select
                    className={s.accessSelect}
                    value={shareType}
                    onChange={e => setShareType(e.target.value)}
                    disabled={!isOwner}
                  >
                    <option value='private'>
                      {t('files:share.restricted', 'Restricted')}
                    </option>
                    <option value='public_link'>
                      {t('files:share.public_link', 'Anyone with the link')}
                    </option>
                    <option value='shared_users'>
                      {t(
                        'files:share.specific_users',
                        'Specific User or Group',
                      )}
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
                            'Only specific users or groups you add below can access',
                          )}
                  </p>
                </div>
              </div>

              {shareType === 'shared_users' && (
                <>
                  <div className={s.searchWrapper}>
                    <SearchableSelect
                      placeholder={t(
                        'files:share.add_people_hint',
                        'Add people and groups',
                      )}
                      onSearch={handleSearch}
                      onChange={handleAddShare}
                      options={searchResults}
                      loading={searching}
                      value=''
                      clearable
                      renderOption={renderSearchResult}
                    />
                  </div>

                  {(shares.length > 0 || fileOwner) && (
                    <>
                      <h4>
                        {t(
                          'files:share.people_with_access',
                          'People with access',
                        )}
                      </h4>
                      <div className={s.shareList}>
                        {fileOwner && (
                          <div className={s.shareItem}>
                            <div className={clsx(s.avatar)}>
                              <Icon name='user' size={16} />
                            </div>
                            <div className={s.shareInfo}>
                              <span className={s.shareName}>
                                {fileOwner.name || fileOwner.email}
                              </span>
                              <span className={s.shareRole}>
                                {t('files:share.owner', 'Owner')}
                              </span>
                            </div>
                            <span
                              className={s.permissionSelect}
                              style={{
                                border: 'none',
                                cursor: 'default',
                                color: 'var(--text-secondary, #5f6368)',
                              }}
                            >
                              {t('files:share.owner', 'Owner')}
                            </span>
                            <div style={{ width: 28 }} />
                            {/* Spacer for remove button */}
                          </div>
                        )}
                        {shares.map((item, index) => (
                          <div key={index} className={s.shareItem}>
                            <div
                              className={clsx(s.avatar, {
                                [s.groupAvatar]: item.entity_type === 'group',
                              })}
                            >
                              <Icon
                                name={
                                  item.entity_type === 'user' ? 'user' : 'users'
                                }
                                size={16}
                              />
                            </div>
                            <div className={s.shareInfo}>
                              <span className={s.shareName}>
                                {(item.user && item.user.email) ||
                                  (item.group && item.group.name)}
                              </span>
                              <span className={s.shareRole}>
                                {item.entity_type === 'user'
                                  ? t('files:share.user', 'User')
                                  : t('files:share.group', 'Group')}
                              </span>
                            </div>
                            <select
                              className={s.permissionSelect}
                              value={item.permission}
                              onChange={e =>
                                handlePermissionChange(index, e.target.value)
                              }
                              disabled={!isOwner && !item.isNew}
                            >
                              <option value='viewer'>
                                {t('files:share.permission_view', 'View')}
                              </option>
                              <option value='editor'>
                                {t(
                                  'files:share.permission_edit_download',
                                  'Edit / Download',
                                )}
                              </option>
                            </select>
                            {(isOwner || item.isNew) && (
                              <Button
                                variant='ghost'
                                size='small'
                                iconOnly
                                className={s.removeBtn}
                                onClick={() => handleRemoveShare(index)}
                              >
                                <Icon name='close' size={14} />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Modal.Actions>
          {!initError ? (
            <>
              <Button variant='outline' size='small' onClick={copyLink}>
                {t('files:share.copy_link', 'Copy link')}
              </Button>
              <div className={s.spacer} />
              <Button variant='primary' onClick={handleSave} loading={loading}>
                {t('files:share.done', 'Done')}
              </Button>
            </>
          ) : (
            <Button variant='primary' onClick={handleClose}>
              {t('files:share.close', 'Close')}
            </Button>
          )}
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

ShareModal.displayName = 'ShareModal';

ShareModal.propTypes = {};

export default ShareModal;
