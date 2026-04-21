/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';

import {
  LockClosedIcon,
  GroupIcon,
  GlobeIcon,
  PersonIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Button, Select } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import { getUserId } from '@shared/renderer/redux/features/user/selector';
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
        <Flex align='center' gap='3' py='2'>
          <Flex
            align='center'
            justify='center'
            width='32px'
            height='32px'
            className={isGroup ? s.avatarGroup : s.avatarUser}
          >
            {(() => {
              const Comp = isGroup ? GroupIcon : PersonIcon;
              return <Comp width={14} height={14} />;
            })()}
          </Flex>
          <Flex direction='column' grow='1' minWidth='0'>
            <Text size='2' weight='medium' truncate highContrast>
              {primaryName}
            </Text>
            <Text as='span' size='1' color='gray'>
              {secondaryName}
            </Text>
          </Flex>
        </Flex>
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
          <Flex
            direction='column'
            align='center'
            justify='center'
            className={s.initErrorContainer}
          >
            <Box className={s.initErrorIcon}>
              <LockClosedIcon width={48} height={48} />
            </Box>
            <Text as='p' size='3' weight='medium'>
              {initError}
            </Text>
          </Flex>
        ) : (
          <Flex direction='column' gap='5'>
            <Box>
              <Text as='h4' size='3' weight='bold' className={s.sectionTitle}>
                {t('files:share.general_access', 'General access')}
              </Text>

              <Flex align='start' gap='3' className={s.generalAccessBox}>
                <Flex
                  align='center'
                  justify='center'
                  className={clsx(
                    s.accessIconBox,
                    shareType === 'private' && s.accessPrivate,
                    shareType === 'shared_users' && s.accessShared,
                    shareType === 'public' && s.accessPublic,
                  )}
                >
                  {shareType === 'private' ? (
                    <LockClosedIcon width={20} height={20} />
                  ) : shareType === 'shared_users' ? (
                    <GroupIcon width={20} height={20} />
                  ) : (
                    <GlobeIcon width={20} height={20} />
                  )}
                </Flex>
                <Flex direction='column' grow='1'>
                  <Select.Root
                    value={shareType}
                    onValueChange={setShareType}
                    disabled={!isOwner}
                  >
                    <Select.Trigger
                      variant='ghost'
                      className={s.selectTrigger}
                    />
                    <Select.Content>
                      <Select.Item value='private'>
                        {t('files:share.restricted', 'Restricted')}
                      </Select.Item>
                      <Select.Item value='public_link'>
                        {t('files:share.public_link', 'Anyone with the link')}
                      </Select.Item>
                      <Select.Item value='shared_users'>
                        {t(
                          'files:share.specific_users',
                          'Specific User or Group',
                        )}
                      </Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <Text as='p' size='1' color='gray'>
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
                  </Text>
                </Flex>
              </Flex>
            </Box>

            {shareType === 'shared_users' && (
              <Box>
                <Box className={s.searchBoxMargin}>
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
                </Box>

                {(shares.length > 0 || fileOwner) && (
                  <Box>
                    <Text
                      as='h4'
                      size='2'
                      weight='bold'
                      className={s.peopleTitle}
                    >
                      {t(
                        'files:share.people_with_access',
                        'People with access',
                      )}
                    </Text>
                    <Flex direction='column' gap='2'>
                      {fileOwner && (
                        <Flex align='center' gap='3' py='2'>
                          <Flex
                            align='center'
                            justify='center'
                            width='32px'
                            height='32px'
                            className={s.avatarGroup}
                          >
                            <PersonIcon width={16} height={16} />
                          </Flex>
                          <Flex direction='column' grow='1' minWidth='0'>
                            <Text
                              size='2'
                              weight='medium'
                              truncate
                              highContrast
                            >
                              {fileOwner.name || fileOwner.email}
                            </Text>
                            <Text as='span' size='1' color='gray'>
                              {t('files:share.owner', 'Owner')}
                            </Text>
                          </Flex>
                          <Text as='span' size='2' className={s.ownerLabel}>
                            {t('files:share.owner', 'Owner')}
                          </Text>
                          <Box width='32px' />
                          {/* Spacer for remove button */}
                        </Flex>
                      )}
                      {shares.map((item, index) => (
                        <Flex key={index} align='center' gap='3' py='2'>
                          <Flex
                            align='center'
                            justify='center'
                            width='32px'
                            height='32px'
                            className={
                              item.entity_type === 'group'
                                ? s.avatarGroup
                                : s.avatarUser
                            }
                          >
                            {(() => {
                              const Comp =
                                item.entity_type === 'user'
                                  ? PersonIcon
                                  : GroupIcon;
                              return <Comp width={16} height={16} />;
                            })()}
                          </Flex>
                          <Flex direction='column' grow='1' minWidth='0'>
                            <Text
                              size='2'
                              weight='medium'
                              truncate
                              highContrast
                            >
                              {(item.user && item.user.email) ||
                                (item.group && item.group.name)}
                            </Text>
                            <Text as='span' size='1' color='gray'>
                              {item.entity_type === 'user'
                                ? t('files:share.user', 'User')
                                : t('files:share.group', 'Group')}
                            </Text>
                          </Flex>

                          <Select.Root
                            value={item.permission}
                            onValueChange={value =>
                              handlePermissionChange(index, value)
                            }
                            disabled={!isOwner && !item.isNew}
                          >
                            <Select.Trigger variant='surface' size='1' />
                            <Select.Content>
                              <Select.Item value='viewer'>
                                {t('files:share.permission_view', 'View')}
                              </Select.Item>
                              <Select.Item value='editor'>
                                {t(
                                  'files:share.permission_edit_download',
                                  'Edit / Download',
                                )}
                              </Select.Item>
                            </Select.Content>
                          </Select.Root>

                          {isOwner || item.isNew ? (
                            <Button
                              variant='ghost'
                              size='1'
                              className={s.closeBtn}
                              onClick={() => handleRemoveShare(index)}
                            >
                              <Cross2Icon width={16} height={16} />
                            </Button>
                          ) : (
                            <Box width='32px' />
                          )}
                        </Flex>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Box>
            )}
          </Flex>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Modal.Actions>
          {!initError ? (
            <>
              <Button variant='outline' size='1' onClick={copyLink}>
                {t('files:share.copy_link', 'Copy link')}
              </Button>
              <Box grow='1' />
              <Button
                variant='solid'
                color='indigo'
                onClick={handleSave}
                loading={loading}
              >
                {t('files:share.done', 'Done')}
              </Button>
            </>
          ) : (
            <Button variant='solid' color='indigo' onClick={handleClose}>
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
