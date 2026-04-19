/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  LockOpen1Icon,
  ArrowLeftIcon,
  PlusIcon,
  ClipboardIcon,
  TrashIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Heading,
  Text,
  Table,
  Button,
  Badge,
  IconButton,
} from '@radix-ui/themes';
import format from 'date-fns/format';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { useRbac } from '@shared/renderer/components/Rbac';
import { showSuccessMessage } from '@shared/renderer/redux';

import { createApiKeyFormSchema } from '../../../../validator/admin';
import {
  fetchUserById,
  getFetchedUser,
  isUserFetchLoading,
  isUserFetchInitialized,
  getUserFetchError,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  getApiKeys,
  getNewApiKey,
  isApiKeysListLoading,
  isApiKeyCreateLoading,
  getApiKeyCreateError,
  clearApiKeyCreateError,
  clearNewApiKey,
  fetchUserPermissions,
  getUserPermissions,
  isUserPermissionsOperationLoading,
} from '../../redux';

import s from './UserApiKeys.css';

const DEFAULT_FORM_VALUES = { name: '', expiresIn: 365, scopes: [] };

export default function UserApiKeys({ userId }) {
  const { t } = useTranslation();
  const history = useHistory();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();

  // Permissions
  const canCreate = hasPermission('apiKeys:create');

  // User Context State
  const user = useSelector(getFetchedUser);
  const userLoading = useSelector(isUserFetchLoading);
  const userInitialized = useSelector(isUserFetchInitialized);
  const userError = useSelector(getUserFetchError);

  // API Keys State
  const keys = useSelector(getApiKeys);
  const newKey = useSelector(getNewApiKey);
  const keysLoading = useSelector(isApiKeysListLoading);
  const creating = useSelector(isApiKeyCreateLoading);
  const createError = useSelector(getApiKeyCreateError);

  // UI State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const confirmRevokeRef = useRef(null);

  // User Permissions State (for scope selection)
  const userPermissions = useSelector(getUserPermissions);
  const permissionsLoading = useSelector(isUserPermissionsOperationLoading);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  useEffect(() => {
    if (userId) {
      dispatch(fetchUserById(userId));
      dispatch(fetchApiKeys(userId));
    }
  }, [dispatch, userId]);

  // Load user's effective permissions when modal opens
  useEffect(() => {
    if (isCreateOpen && userId) {
      dispatch(fetchUserPermissions(userId));
    }
  }, [isCreateOpen, userId, dispatch]);

  // Transform permission strings into items for CheckboxList
  const permissions = useMemo(() => {
    if (!Array.isArray(userPermissions)) return [];
    return userPermissions.map(perm => ({
      ...perm,
      value: `${perm.resource}:${perm.action}`,
    }));
  }, [userPermissions]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleCreate = useCallback(
    async formData => {
      try {
        await dispatch(
          createApiKey({
            userId,
            name: formData.name,
            expiresIn: formData.expiresIn,
            scopes: formData.scopes,
          }),
        ).unwrap();
        setIsCreateOpen(false);
      } catch (_error) {
        // Error handled by Redux state
      }
    },
    [dispatch, userId],
  );

  const onRevoke = useCallback(
    async key => {
      try {
        await dispatch(revokeApiKey({ userId, keyId: key.id })).unwrap();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    [dispatch, userId],
  );

  const handleRevoke = useCallback(key => {
    confirmRevokeRef.current.open(key);
  }, []);

  const handleCopy = useCallback(
    text => {
      navigator.clipboard.writeText(text);
      dispatch(
        showSuccessMessage({
          message: t('admin:users.apiKeys.copied', 'Copied to clipboard'),
        }),
      );
    },
    [dispatch, t],
  );

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
    dispatch(clearApiKeyCreateError());
  }, [dispatch]);

  const handleCloseNewKeyAlert = useCallback(() => {
    dispatch(clearNewApiKey());
  }, [dispatch]);

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================

  const getHeader = () => (
    <Flex
      align='center'
      justify='between'
      wrap='wrap'
      gap='4'
      className={s.headerFlex}
    >
      <Flex align='center' gap='3'>
        <Flex align='center' justify='center' className={s.headerIconBox}>
          <LockOpen1Icon width={24} height={24} />
        </Flex>
        <Flex direction='column'>
          <Heading size='6' className={s.headerHeading}>
            {user
              ? t('admin:users.apiKeys.headerTitle', 'API Keys: {{name}}', {
                  name:
                    (user.profile && user.profile.display_name) || user.email,
                })
              : t('admin:users.apiKeys.headerTitle', 'User API Keys')}
          </Heading>
          <Text size='3' color='gray' className={s.headerSubtitle}>
            {t(
              'admin:users.apiKeys.headerSubtitle',
              'Manage API keys for this user',
            )}
          </Text>
        </Flex>
      </Flex>
      <Flex gap='2'>
        <Button
          variant='soft'
          color='gray'
          onClick={() => history.push('/admin/users')}
        >
          <ArrowLeftIcon />
          {t('admin:users.apiKeys.backToUsers', 'Back to Users')}
        </Button>
        <Button
          variant='solid'
          color='indigo'
          onClick={() => setIsCreateOpen(true)}
          {...(canCreate
            ? { title: t('admin:users.apiKeys.generateKey', 'Generate Key') }
            : {
                disabled: true,
                title: t(
                  'admin:users.apiKeys.noPermissionToCreate',
                  'You do not have permission to create API keys',
                ),
              })}
        >
          <PlusIcon width={16} height={16} />
          {t('admin:users.apiKeys.generateKey', 'Generate Key')}
        </Button>
      </Flex>
    </Flex>
  );

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  if (!userInitialized || userLoading) {
    return (
      <Box className={s.containerBox}>
        {getHeader()}
        <Loader
          variant='skeleton'
          message={t('admin:users.apiKeys.loading', 'Loading...')}
        />
      </Box>
    );
  }

  if (userError || !user) {
    return (
      <Box className={s.containerBox}>
        {getHeader()}
        <Box className={s.marginTopBox}>
          <Flex
            direction='column'
            align='center'
            justify='center'
            p='6'
            className={s.errorFlex}
          >
            <Text color='red' size='4' weight='bold' mb='2'>
              {t('admin:users.apiKeys.userNotFoundError', 'User not found')}
            </Text>
            <Text color='red' size='2' mb='4'>
              {userError || 'Cannot load user context'}
            </Text>
            <Button
              variant='soft'
              color='gray'
              onClick={() => history.push('/admin/users')}
            >
              {t('admin:users.apiKeys.backToUsers', 'Back to Users')}
            </Button>
          </Flex>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={s.containerBox}>
      {getHeader()}

      <Box className={s.marginTopBox}>
        {/* New key banner — shown once after generation */}
        {newKey && (
          <Box className={s.newKeyBox}>
            <Flex
              align='center'
              justify='between'
              className={s.newKeyHeaderFlex}
            >
              <Text as='strong' size='3' className={s.newKeyTitle}>
                {t(
                  'admin:users.apiKeys.newKeyGenerated',
                  'New API Key Generated!',
                )}
              </Text>
              <IconButton
                variant='ghost'
                color='green'
                size='1'
                onClick={handleCloseNewKeyAlert}
                aria-label={t('admin:users.apiKeys.close', 'Close')}
              >
                <Cross2Icon />
              </IconButton>
            </Flex>
            <Text as='p' size='2' className={s.newKeyDesc}>
              {t(
                'admin:users.apiKeys.newKeyGeneratedText',
                'Please copy this key now. It will not be shown again.',
              )}
            </Text>
            <Flex
              align='center'
              justify='between'
              className={s.newKeyTokenFlex}
            >
              <Text as='code' className={s.newKeyTokenText}>
                {newKey.token}
              </Text>
              <Button
                variant='soft'
                color='gray'
                size='1'
                onClick={() => handleCopy(newKey.token)}
              >
                <ClipboardIcon width={14} height={14} />
                {t('admin:users.apiKeys.copy', 'Copy')}
              </Button>
            </Flex>
          </Box>
        )}

        <Box className={s.tableWrapper}>
          <Table.Root variant='surface'>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>
                  {t('admin:users.apiKeys.name', 'Name')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.apiKeys.prefix', 'Prefix')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.apiKeys.created', 'Created')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.apiKeys.lastUsed', 'Last Used')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('admin:users.apiKeys.status', 'Status')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  className={s.textRight}
                ></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {keys.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Flex
                      justify='center'
                      align='center'
                      direction='column'
                      py='9'
                      className={s.emptyStateFlex}
                    >
                      <LockOpen1Icon
                        width={48}
                        height={48}
                        className={s.emptyStateIcon}
                      />

                      <Text size='3' weight='bold'>
                        {t('admin:users.apiKeys.emptyState', 'No API keys yet')}
                      </Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                keys.map(key => (
                  <Table.Row
                    key={key.id}
                    className={key.is_active ? '' : 'is-revoked'}
                  >
                    <Table.Cell>{key.name}</Table.Cell>
                    <Table.Cell>
                      <code>{key.token_prefix}…</code>
                    </Table.Cell>
                    <Table.Cell>
                      {key.created_at
                        ? format(new Date(key.created_at), 'yyyy-MM-dd')
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {key.last_used_at
                        ? format(new Date(key.last_used_at), 'yyyy-MM-dd HH:mm')
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        variant={key.is_active ? 'success' : 'neutral'}
                        color='gray'
                        radius='full'
                      >
                        {key.is_active
                          ? t('admin:users.apiKeys.statusActive', 'Active')
                          : t('admin:users.apiKeys.statusRevoked', 'Revoked')}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className={s.textRight}>
                      <Flex justify='end'>
                        {key.is_active && (
                          <Button
                            variant='ghost'
                            size='1'
                            onClick={() => handleRevoke(key)}
                            title={t('admin:users.apiKeys.revoke', 'Revoke')}
                          >
                            <TrashIcon width={16} height={16} />
                          </Button>
                        )}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
          {keysLoading && (
            <Box className={s.loadingOverlay}>
              <Loader variant='spinner' />
            </Box>
          )}
        </Box>
      </Box>

      {/* Create key modal */}
      <Modal isOpen={isCreateOpen} onClose={handleCloseCreate}>
        <Modal.Header onClose={handleCloseCreate}>
          {t('admin:users.apiKeys.generateNewKey', 'Generate New API Key')}
        </Modal.Header>
        <Modal.Body error={createError}>
          <Form
            id='create-api-key-form'
            onSubmit={handleCreate}
            schema={createApiKeyFormSchema}
            defaultValues={DEFAULT_FORM_VALUES}
          >
            <Box className={s.fieldPaddingBox}>
              <Form.Field
                name='name'
                label={t('admin:users.apiKeys.keyName', 'Key Name')}
              >
                <Form.Input
                  placeholder={t(
                    'admin:users.apiKeys.keyNamePlaceholder',
                    'e.g. CI/CD Pipeline',
                  )}
                />
              </Form.Field>
            </Box>
            <Box className={s.fieldPaddingBox}>
              <Form.Field
                name='expiresIn'
                label={t('admin:users.apiKeys.expiration', 'Expiration')}
              >
                <Form.Select
                  options={[
                    {
                      value: 7,
                      label: t('admin:users.apiKeys.7Days', '7 Days'),
                    },
                    {
                      value: 14,
                      label: t('admin:users.apiKeys.14Days', '14 Days'),
                    },
                    {
                      value: 30,
                      label: t('admin:users.apiKeys.30Days', '30 Days'),
                    },
                    {
                      value: 60,
                      label: t('admin:users.apiKeys.60Days', '60 Days'),
                    },
                    {
                      value: 90,
                      label: t('admin:users.apiKeys.90Days', '90 Days'),
                    },
                    {
                      value: 180,
                      label: t('admin:users.apiKeys.180Days', '180 Days'),
                    },
                    {
                      value: 365,
                      label: t('admin:users.apiKeys.1Year', '1 Year'),
                    },
                  ]}
                />
              </Form.Field>
            </Box>
            <Box className={s.fieldPaddingBox}>
              <Form.Field
                name='scopes'
                label={t('admin:users.apiKeys.permissions', 'Permissions')}
                description={t(
                  'admin:users.apiKeys.permissionsDescription',
                  'Select permissions for this API key',
                )}
              >
                <Form.CheckboxList
                  items={permissions}
                  valueKey='name'
                  labelKey='description'
                  groupBy='resource'
                  loading={permissionsLoading}
                  searchable
                  searchPlaceholder={t(
                    'admin:users.apiKeys.permissionsSearchPlaceholder',
                    'Search e.g. users, users:read, :create',
                  )}
                  emptyMessage={t(
                    'admin:users.apiKeys.permissionsEmptyMessage',
                    'No permissions found',
                  )}
                />
              </Form.Field>
            </Box>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.Button variant='secondary' onClick={handleCloseCreate}>
              {t('admin:users.apiKeys.cancel', 'Cancel')}
            </Modal.Button>
            <Modal.Button
              variant='primary'
              type='submit'
              form='create-api-key-form'
              disabled={creating}
            >
              {creating
                ? t('admin:users.apiKeys.generating', 'Generating…')
                : t('admin:users.apiKeys.generate', 'Generate')}
            </Modal.Button>
          </Modal.Actions>
        </Modal.Footer>
      </Modal>

      {/* Revoke confirmation modal */}
      <Modal.ConfirmDelete
        ref={confirmRevokeRef}
        title={t('admin:users.apiKeys.revokeTitle', 'Revoke API Key')}
        getItemName={key => key.name}
        onDelete={onRevoke}
      />
    </Box>
  );
}

UserApiKeys.propTypes = {
  userId: PropTypes.string.isRequired,
};
