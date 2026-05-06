/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  TokensIcon,
  ArrowLeftIcon,
  PlusIcon,
  ClipboardIcon,
  TrashIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';
import { Box, Flex, Text, Button, Badge, IconButton } from '@radix-ui/themes';
import format from 'date-fns/format';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form from '@shared/renderer/components/Form/index.js';
import { useHistory } from '@shared/renderer/components/History/index.js';
import Modal from '@shared/renderer/components/Modal/index.js';
import { useRbac } from '@shared/renderer/components/Rbac/index.js';
import { DataTable } from '@shared/renderer/components/Table/index.js';
import { features } from '@shared/renderer/redux/index.js';

import { createApiKeyFormSchema } from '../../../../validator/admin/index.js';
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
} from '../../redux/index.js';

import s from './UserApiKeys.css';
const { showSuccessMessage } = features;

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
          message: t('users:admin.apiKeys.copied', 'Copied to clipboard'),
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
  // TABLE COLUMNS
  // =========================================================================

  const columns = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('users:admin.apiKeys.name', 'Name'),
        order: 10,
      },
      {
        key: 'prefix',
        dataIndex: 'token_prefix',
        title: t('users:admin.apiKeys.prefix', 'Prefix'),
        order: 20,
        render: prefix => <code>{prefix}…</code>,
      },
      {
        key: 'created',
        dataIndex: 'created_at',
        title: t('users:admin.apiKeys.created', 'Created'),
        order: 30,
        render: createdAt => (
          <Text size='2' color='gray'>
            {createdAt ? format(new Date(createdAt), 'yyyy-MM-dd') : '—'}
          </Text>
        ),
      },
      {
        key: 'lastUsed',
        dataIndex: 'last_used_at',
        title: t('users:admin.apiKeys.lastUsed', 'Last Used'),
        order: 40,
        render: lastUsedAt => (
          <Text size='2' color='gray'>
            {lastUsedAt
              ? format(new Date(lastUsedAt), 'yyyy-MM-dd HH:mm')
              : '—'}
          </Text>
        ),
      },
      {
        key: 'status',
        dataIndex: 'is_active',
        title: t('users:admin.apiKeys.status', 'Status'),
        order: 50,
        render: isActive => (
          <Badge
            variant={isActive ? 'success' : 'error'}
            color='gray'
            radius='full'
          >
            {isActive
              ? t('users:admin.apiKeys.statusActive', 'Active')
              : t('users:admin.apiKeys.statusRevoked', 'Revoked')}
          </Badge>
        ),
      },
      {
        key: 'actions',
        title: '',
        order: 9999,
        className: 'text-right',
        render: (_, record) => (
          <Flex gap='2' justify='end' onClick={e => e.stopPropagation()}>
            {record.is_active && (
              <IconButton
                variant='ghost'
                size='2'
                onClick={() => handleRevoke(record)}
                title={t('users:admin.apiKeys.revoke', 'Revoke')}
              >
                <TrashIcon width={16} height={16} />
              </IconButton>
            )}
          </Flex>
        ),
      },
    ],

    [t, handleRevoke],
  );

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  if (!userInitialized || userLoading) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <DataTable
          columns={[]}
          dataSource={[]}
          rowKey='id'
          loading={true}
          initialized={false}
        >
          <DataTable.Header
            title={t('users:admin.apiKeys.headerTitle', 'User API Keys')}
            subtitle={t(
              'users:admin.apiKeys.headerSubtitle',
              'Manage API keys for this user',
            )}
            icon={<TokensIcon width={24} height={24} />}
          >
            <Button
              variant='ghost'
              color='gray'
              onClick={() => history.push('/admin/users')}
            >
              <ArrowLeftIcon />
              {t('users:admin.apiKeys.backToUsers', 'Back to Users')}
            </Button>
          </DataTable.Header>
          <DataTable.Loader />
        </DataTable>
      </Box>
    );
  }

  if (userError || !user) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <DataTable
          columns={[]}
          dataSource={[]}
          rowKey='id'
          loading={false}
          initialized={true}
        >
          <DataTable.Header
            title={t('users:admin.apiKeys.headerTitle', 'User API Keys')}
            subtitle={t(
              'users:admin.apiKeys.headerSubtitle',
              'Manage API keys for this user',
            )}
            icon={<TokensIcon width={24} height={24} />}
          >
            <Button
              variant='ghost'
              color='gray'
              onClick={() => history.push('/admin/users')}
            >
              <ArrowLeftIcon />
              {t('users:admin.apiKeys.backToUsers', 'Back to Users')}
            </Button>
          </DataTable.Header>
          <DataTable.Error
            message={
              userError ||
              t('users:admin.apiKeys.userNotFoundError', 'User not found')
            }
          />
        </DataTable>
      </Box>
    );
  }

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      {newKey && (
        <Box className={s.newKeyBox} mb='6'>
          <Flex align='center' justify='between' className={s.newKeyHeaderFlex}>
            <Text as='strong' size='3' className={s.newKeyTitle}>
              {t(
                'users:admin.apiKeys.newKeyGenerated',
                'New API Key Generated!',
              )}
            </Text>
            <IconButton
              variant='ghost'
              color='green'
              size='1'
              onClick={handleCloseNewKeyAlert}
              aria-label={t('users:admin.apiKeys.close', 'Close')}
            >
              <Cross2Icon />
            </IconButton>
          </Flex>
          <Text as='p' size='2' className={s.newKeyDesc}>
            {t(
              'users:admin.apiKeys.newKeyGeneratedText',
              'Please copy this key now. It will not be shown again.',
            )}
          </Text>
          <Flex align='center' justify='between' className={s.newKeyTokenFlex}>
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
              {t('users:admin.apiKeys.copy', 'Copy')}
            </Button>
          </Flex>
        </Box>
      )}

      <DataTable
        columns={columns}
        dataSource={keys}
        rowKey='id'
        loading={keysLoading}
        initialized={true}
      >
        <DataTable.Header
          title={
            user
              ? t('users:admin.apiKeys.headerTitle', 'API Keys: {{name}}', {
                  name:
                    (user.profile && user.profile.display_name) || user.email,
                })
              : t('users:admin.apiKeys.headerTitle', 'User API Keys')
          }
          subtitle={t(
            'users:admin.apiKeys.headerSubtitle',
            'Manage API keys for this user',
          )}
          icon={<TokensIcon width={24} height={24} />}
        >
          <Button
            variant='ghost'
            color='gray'
            onClick={() => history.push('/admin/users')}
          >
            <ArrowLeftIcon />
            {t('users:admin.apiKeys.backToUsers', 'Back to Users')}
          </Button>
          <Button
            variant='solid'
            color='indigo'
            onClick={() => setIsCreateOpen(true)}
            {...(canCreate
              ? { title: t('users:admin.apiKeys.generateKey', 'Generate Key') }
              : {
                  disabled: true,
                  title: t(
                    'users:admin.apiKeys.noPermissionToCreate',
                    'You do not have permission to create API keys',
                  ),
                })}
          >
            <PlusIcon width={16} height={16} />
            {t('users:admin.apiKeys.generateKey', 'Generate Key')}
          </Button>
        </DataTable.Header>

        <DataTable.Empty
          icon={<TokensIcon width={48} height={48} />}
          title={t('users:admin.apiKeys.emptyState', 'No API keys yet')}
        />

        <DataTable.Loader />
      </DataTable>

      {/* Create key modal */}
      <Modal isOpen={isCreateOpen} onClose={handleCloseCreate}>
        <Modal.Header onClose={handleCloseCreate}>
          {t('users:admin.apiKeys.generateNewKey', 'Generate New API Key')}
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
                label={t('users:admin.apiKeys.keyName', 'Key Name')}
              >
                <Form.Input
                  placeholder={t(
                    'users:admin.apiKeys.keyNamePlaceholder',
                    'e.g. CI/CD Pipeline',
                  )}
                />
              </Form.Field>
            </Box>
            <Box className={s.fieldPaddingBox}>
              <Form.Field
                name='expiresIn'
                label={t('users:admin.apiKeys.expiration', 'Expiration')}
              >
                <Form.Select
                  options={[
                    {
                      value: 7,
                      label: t('users:admin.apiKeys.7Days', '7 Days'),
                    },
                    {
                      value: 14,
                      label: t('users:admin.apiKeys.14Days', '14 Days'),
                    },
                    {
                      value: 30,
                      label: t('users:admin.apiKeys.30Days', '30 Days'),
                    },
                    {
                      value: 60,
                      label: t('users:admin.apiKeys.60Days', '60 Days'),
                    },
                    {
                      value: 90,
                      label: t('users:admin.apiKeys.90Days', '90 Days'),
                    },
                    {
                      value: 180,
                      label: t('users:admin.apiKeys.180Days', '180 Days'),
                    },
                    {
                      value: 365,
                      label: t('users:admin.apiKeys.1Year', '1 Year'),
                    },
                  ]}
                />
              </Form.Field>
            </Box>
            <Box className={s.fieldPaddingBox}>
              <Form.Field
                name='scopes'
                label={t('users:admin.apiKeys.permissions', 'Permissions')}
                description={t(
                  'users:admin.apiKeys.permissionsDescription',
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
                    'users:admin.apiKeys.permissionsSearchPlaceholder',
                    'Search e.g. users, users:read, :create',
                  )}
                  emptyMessage={t(
                    'users:admin.apiKeys.permissionsEmptyMessage',
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
              {t('users:admin.apiKeys.cancel', 'Cancel')}
            </Modal.Button>
            <Modal.Button
              variant='primary'
              type='submit'
              form='create-api-key-form'
              disabled={creating}
            >
              {creating
                ? t('users:admin.apiKeys.generating', 'Generating…')
                : t('users:admin.apiKeys.generate', 'Generate')}
            </Modal.Button>
          </Modal.Actions>
        </Modal.Footer>
      </Modal>

      {/* Revoke confirmation modal */}
      <Modal.ConfirmDelete
        ref={confirmRevokeRef}
        title={t('users:admin.apiKeys.revokeTitle', 'Revoke API Key')}
        getItemName={key => key.name}
        onDelete={onRevoke}
      />
    </Box>
  );
}

UserApiKeys.propTypes = {
  userId: PropTypes.string.isRequired,
};
