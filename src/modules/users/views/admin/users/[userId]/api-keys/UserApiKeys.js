/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
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
} from '../../redux';
import { createApiKeyFormSchema } from '../../../../../validator/admin';
import s from './UserApiKeys.css';

const DEFAULT_FORM_VALUES = { name: '', expiresIn: 365, scopes: '' };

export default function UserApiKeys({ userId }) {
  const { t } = useTranslation();
  const history = useHistory();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();

  // Permissions
  const canCreateApiKey = hasPermission('api_keys:create');

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

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  useEffect(() => {
    if (userId) {
      dispatch(fetchUserById(userId));
      dispatch(fetchApiKeys(userId));
    }
  }, [dispatch, userId]);

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

  const handleCopy = useCallback(text => {
    navigator.clipboard.writeText(text);
  }, []);

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
          ? t('API Keys: {{name}}', {
              name: user.display_name || user.email,
            })
          : t('User API Keys')
      }
      subtitle={t('Manage API keys for this user')}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          variant='secondary'
          onClick={() => history.push('/admin/users')}
        >
          {t('← Back to Users')}
        </Button>
        <Button
          variant='primary'
          onClick={() => setIsCreateOpen(true)}
          disabled={!canCreateApiKey}
        >
          <Icon name='plus' size={16} />
          {t('Generate Key')}
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
        <Loader variant='skeleton' message={t('Loading user...')} />
      </div>
    );
  }

  if (userError || !user) {
    return (
      <div className={s.root}>
        {getHeader()}
        <div className={s.content}>
          <div className={s.error}>
            {userError || t('User not found')}
            <Button
              variant='secondary'
              onClick={() => history.push('/admin/users')}
            >
              {t('Back to Users')}
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
              <strong>{t('New API Key Generated!')}</strong>
              <button
                className={s.closeBtn}
                onClick={handleCloseNewKeyAlert}
                aria-label={t('Close')}
              >
                ×
              </button>
            </div>
            <p className={s.alertText}>
              {t('Please copy this key now. It will not be shown again.')}
            </p>
            <div className={s.tokenDisplay}>
              <code>{newKey.token}</code>
              <Button
                variant='secondary'
                size='small'
                onClick={() => handleCopy(newKey.token)}
              >
                <Icon name='copy' size={14} />
                {t('Copy')}
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
            <p>{t('No API keys yet')}</p>
          </div>
        ) : (
          <div className={s.tableContainer}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('Name')}</th>
                  <th>{t('Prefix')}</th>
                  <th>{t('Created')}</th>
                  <th>{t('Last Used')}</th>
                  <th>{t('Status')}</th>
                  <th className={s.actionsCol}>{t('Actions')}</th>
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
                    <td>{format(new Date(key.created_at), 'yyyy-MM-dd')}</td>
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
                        {key.is_active ? t('Active') : t('Revoked')}
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
                            title={t('Revoke')}
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
          {t('Generate New API Key')}
        </Modal.Header>
        <Modal.Body error={createError}>
          <Form
            onSubmit={handleCreate}
            schema={createApiKeyFormSchema}
            defaultValues={DEFAULT_FORM_VALUES}
          >
            <div className={s.modalField}>
              <Form.Field name='name' label={t('Key Name')}>
                <Form.Input placeholder={t('e.g. CI/CD Pipeline')} />
              </Form.Field>
            </div>

            <div className={s.modalField}>
              <Form.Field name='expiresIn' label={t('Expiration')}>
                <Form.Select
                  options={[
                    { value: 7, label: t('7 Days') },
                    { value: 14, label: t('14 Days') },
                    { value: 30, label: t('30 Days') },
                    { value: 60, label: t('60 Days') },
                    { value: 90, label: t('90 Days') },
                    { value: 180, label: t('180 Days') },
                    { value: 365, label: t('1 Year') },
                  ]}
                />
              </Form.Field>
            </div>

            <div className={s.modalField}>
              <Form.Field
                name='scopes'
                label={t('Scopes (comma separated)')}
                description={t('e.g. users:read, users:write')}
              >
                <Form.Input placeholder={t('users:read, users:write')} />
              </Form.Field>
            </div>

            <Modal.Actions>
              <Modal.Button variant='secondary' onClick={handleCloseCreate}>
                {t('Cancel')}
              </Modal.Button>
              <Modal.Button variant='primary' type='submit' disabled={creating}>
                {creating ? t('Generating…') : t('Generate')}
              </Modal.Button>
            </Modal.Actions>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Revoke confirmation modal */}
      <ConfirmModal.Delete
        ref={confirmRevokeRef}
        title={t('Revoke API Key')}
        getItemName={key => key.name}
        onDelete={onRevoke}
      />
    </div>
  );
}

UserApiKeys.propTypes = {
  userId: PropTypes.string.isRequired,
};
