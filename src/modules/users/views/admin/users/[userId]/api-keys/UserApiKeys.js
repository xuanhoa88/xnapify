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
import { useRbac } from '../../../../../../../shared/renderer/components/Rbac';
import { useHistory } from '../../../../../../../shared/renderer/components/History';
import {
  Box,
  Icon,
  Loader,
  ConfirmModal,
} from '../../../../../../../shared/renderer/components/Admin';
import Button from '../../../../../../../shared/renderer/components/Button';
import Form from '../../../../../../../shared/renderer/components/Form';
import Modal from '../../../../../../../shared/renderer/components/Modal';
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
import { showSuccessMessage } from '../../../../../../../shared/renderer/redux';
import { createApiKeyFormSchema } from '../../../../../validator/admin';
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
  const userPermissionStrings = useSelector(getUserPermissions);
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
    if (!Array.isArray(userPermissionStrings)) return [];
    return userPermissionStrings.map(perm => {
      const [resource, action] = perm.split('admin:.');
      return {
        value: perm,
        label: perm,
        resource,
        action,
      };
    });
  }, [userPermissionStrings]);

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
          disabled={!canCreate}
          title={
            !canCreate
              ? t(
                  'admin:users.apiKeys.noPermissionToCreate',
                  'You do not have permission to create API keys',
                )
              : t('admin:users.apiKeys.generateKey', 'Generate Key')
          }
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
        <div className={s.content}>
          <div className={s.error}>
            {userError ||
              t('admin:users.apiKeys.userNotFoundError', 'User not found')}
            <Button
              variant='secondary'
              onClick={() => history.push('/admin/users')}
            >
              {t('admin:users.apiKeys.backToUsers', 'Back to Users')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      {getHeader()}

      <div className={s.content}>
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

        {/* Key list */}
        {keysLoading && keys.length === 0 ? (
          <div className={s.loadingState}>
            <Loader variant='spinner' />
          </div>
        ) : keys.length === 0 ? (
          <div className={s.emptyState}>
            <Icon name='key' size={32} />
            <p>{t('admin:users.apiKeys.emptyState', 'No API keys yet')}</p>
          </div>
        ) : (
          <div className={s.tableContainer}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('admin:users.apiKeys.name', 'Name')}</th>
                  <th>{t('admin:users.apiKeys.prefix', 'Prefix')}</th>
                  <th>{t('admin:users.apiKeys.created', 'Created')}</th>
                  <th>{t('admin:users.apiKeys.lastUsed', 'Last Used')}</th>
                  <th>{t('admin:users.apiKeys.status', 'Status')}</th>
                  <th className={s.actionsCol}></th>
                </tr>
              </thead>
              <tbody>
                {keys.map(key => (
                  <tr
                    key={key.id}
                    className={cn({ [s.revoked]: !key.is_active })}
                  >
                    <td>{key.name}</td>
                    <td>
                      <code>{key.token_prefix}…</code>
                    </td>
                    <td>
                      {key.created_at
                        ? format(new Date(key.created_at), 'yyyy-MM-dd')
                        : '—'}
                    </td>
                    <td>
                      {key.last_used_at
                        ? format(new Date(key.last_used_at), 'yyyy-MM-dd HH:mm')
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={cn(
                          s.badge,
                          key.is_active ? s.badgeActive : s.badgeRevoked,
                        )}
                      >
                        {key.is_active
                          ? t('admin:users.apiKeys.statusActive', 'Active')
                          : t('admin:users.apiKeys.statusRevoked', 'Revoked')}
                      </span>
                    </td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  valueKey='value'
                  labelKey='label'
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
