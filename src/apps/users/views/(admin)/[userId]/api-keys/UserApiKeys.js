/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import format from 'date-fns/format';
import cn from 'clsx';
import { useRbac } from '../../../../../../shared/renderer/components/Rbac';
import { useHistory } from '../../../../../../shared/renderer/components/History';
import * as Box from '../../../../../../shared/renderer/components/Box';
import Icon from '../../../../../../shared/renderer/components/Icon';
import Loader from '../../../../../../shared/renderer/components/Loader';
import ConfirmModal from '../../../../../../shared/renderer/components/ConfirmModal';
import Table from '../../../../../../shared/renderer/components/Table';
import Tag from '../../../../../../shared/renderer/components/Tag';
import Button from '../../../../../../shared/renderer/components/Button';
import Form from '../../../../../../shared/renderer/components/Form';
import Modal from '../../../../../../shared/renderer/components/Modal';
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
import { showSuccessMessage } from '../../../../../../shared/renderer/redux';
import { createApiKeyFormSchema } from '../../../../validator/admin';
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
    <Box.Header
      icon={<Icon name='key' size={24} />}
      title={
        user
          ? t('admin:users.apiKeys.headerTitle', 'API Keys: {{name}}', {
              name: (user.profile && user.profile.display_name) || user.email,
            })
          : t('admin:users.apiKeys.headerTitle', 'User API Keys')
      }
      subtitle={t(
        'admin:users.apiKeys.headerSubtitle',
        'Manage API keys for this user',
      )}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          variant='secondary'
          onClick={() => history.push('/admin/users')}
        >
          <Icon name='arrowLeft' />
          {t('admin:users.apiKeys.backToUsers', 'Back to Users')}
        </Button>
        <Button
          variant='primary'
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
          <Icon name='plus' size={16} />
          {t('admin:users.apiKeys.generateKey', 'Generate Key')}
        </Button>
      </div>
    </Box.Header>
  );

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  if (!userInitialized || userLoading) {
    return (
      <div className={s.root}>
        {getHeader()}
        <Loader
          variant='skeleton'
          message={t('admin:users.apiKeys.loading', 'Loading...')}
        />
      </div>
    );
  }

  if (userError || !user) {
    return (
      <div className={s.root}>
        {getHeader()}
        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <Table.Error
            title={t('admin:users.apiKeys.userNotFoundError', 'User not found')}
            error={userError}
            action={
              <Button
                variant='secondary'
                onClick={() => history.push('/admin/users')}
              >
                {t('admin:users.apiKeys.backToUsers', 'Back to Users')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      {getHeader()}

      <div style={{ marginTop: 'var(--spacing-6)' }}>
        {/* New key banner — shown once after generation */}
        {newKey && (
          <div className={s.newKeyAlert}>
            <div className={s.alertHeader}>
              <strong>
                {t(
                  'admin:users.apiKeys.newKeyGenerated',
                  'New API Key Generated!',
                )}
              </strong>
              <button
                className={s.closeBtn}
                onClick={handleCloseNewKeyAlert}
                aria-label={t('admin:users.apiKeys.close', 'Close')}
              >
                ×
              </button>
            </div>
            <p className={s.alertText}>
              {t(
                'admin:users.apiKeys.newKeyGeneratedText',
                'Please copy this key now. It will not be shown again.',
              )}
            </p>
            <div className={s.tokenDisplay}>
              <code>{newKey.token}</code>
              <Button
                variant='secondary'
                size='small'
                onClick={() => handleCopy(newKey.token)}
              >
                <Icon name='clipboard' size={14} />
                {t('admin:users.apiKeys.copy', 'Copy')}
              </Button>
            </div>
          </div>
        )}

        <Table
          columns={[
            {
              title: t('admin:users.apiKeys.name', 'Name'),
              dataIndex: 'name',
            },
            {
              title: t('admin:users.apiKeys.prefix', 'Prefix'),
              dataIndex: 'token_prefix',
              render: prefix => <code>{prefix}…</code>,
            },
            {
              title: t('admin:users.apiKeys.created', 'Created'),
              dataIndex: 'created_at',
              render: date =>
                date ? format(new Date(date), 'yyyy-MM-dd') : '—',
            },
            {
              title: t('admin:users.apiKeys.lastUsed', 'Last Used'),
              dataIndex: 'last_used_at',
              render: date =>
                date ? format(new Date(date), 'yyyy-MM-dd HH:mm') : '—',
            },
            {
              title: t('admin:users.apiKeys.status', 'Status'),
              key: 'status',
              render: (_, key) => (
                <Tag variant={key.is_active ? 'success' : 'neutral'}>
                  {key.is_active
                    ? t('admin:users.apiKeys.statusActive', 'Active')
                    : t('admin:users.apiKeys.statusRevoked', 'Revoked')}
                </Tag>
              ),
            },
            {
              key: 'actions',
              className: s.actionsCol,
              render: (_, key) => (
                <div className={s.actions}>
                  {key.is_active && (
                    <Button
                      variant='ghost'
                      size='small'
                      iconOnly
                      onClick={() => handleRevoke(key)}
                      title={t('admin:users.apiKeys.revoke', 'Revoke')}
                    >
                      <Icon name='trash' size={16} />
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          dataSource={keys}
          loading={keysLoading}
          rowKey='id'
          rowClassName={record => cn({ [s.revoked]: !record.is_active })}
          locale={{
            emptyText: (
              <Table.Empty
                icon='key'
                title={t('admin:users.apiKeys.emptyState', 'No API keys yet')}
              />
            ),
          }}
        />
      </div>

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
            <div className={s.modalField}>
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
            </div>
            <div className={s.modalField}>
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
            </div>
            <div className={s.modalField}>
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
            </div>
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
      <ConfirmModal.Delete
        ref={confirmRevokeRef}
        title={t('admin:users.apiKeys.revokeTitle', 'Revoke API Key')}
        getItemName={key => key.name}
        onDelete={onRevoke}
      />
    </div>
  );
}

UserApiKeys.propTypes = {
  userId: PropTypes.string.isRequired,
};
