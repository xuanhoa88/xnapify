/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import { useRbac } from '@shared/renderer/components/Rbac';
import Table from '@shared/renderer/components/Table';
import {
  showSuccessMessage,
  showWarningMessage,
} from '@shared/renderer/redux/features/ui/slice';
import { useWebSocket } from '@shared/ws/client';

import ExtensionCard from './components/ExtensionCard';
import {
  fetchExtensions,
  uploadExtension,
  upgradeExtension,
  toggleExtensionStatus,
  uninstallExtension,
  getExtensions,
  isExtensionsListLoading,
  isExtensionUploading,
  isExtensionsInitialized,
} from './redux';

import s from './Extensions.css';

function Extensions() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('extensions:create');
  const canUpdate = hasPermission('extensions:update');

  const extensions = useSelector(getExtensions);
  const loading = useSelector(isExtensionsListLoading);
  const uploading = useSelector(isExtensionUploading);
  const initialized = useSelector(isExtensionsInitialized);

  // Search state
  const [search, setSearch] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [actionMap, setActionMap] = useState({});

  // Modals & Refs
  const deleteModalRef = useRef();
  const activateModalRef = useRef();
  const deactivateModalRef = useRef();
  const installModalRef = useRef();
  const fileInputRef = useRef();
  const pendingFileRef = useRef(null);

  useEffect(() => {
    dispatch(fetchExtensions());
  }, [dispatch]);

  // Listen for background job completion via WebSocket to refresh extension list
  const ws = useWebSocket();
  useEffect(() => {
    if (!ws) return;
    const handler = data => {
      if (!data) return;
      switch (data.type) {
        case 'EXTENSION_INSTALLED':
        case 'EXTENSION_UPDATED':
        case 'EXTENSION_UNINSTALLED': {
          dispatch(fetchExtensions());
          if (data.extensionId) {
            setActionMap(prev => {
              if (!(data.extensionId in prev)) return prev;
              const next = { ...prev };
              delete next[data.extensionId];
              return next;
            });
          }
          break;
        }
        case 'EXTENSION_TAMPERED': {
          dispatch(fetchExtensions());
          dispatch(
            showWarningMessage({
              message: t(
                'admin:extensions.tampered',
                'An extension failed integrity verification and has been deactivated for security.',
              ),
            }),
          );
          break;
        }
        default:
          break;
      }
    };
    ws.on('extension:updated', handler);
    return () => {
      ws.off('extension:updated', handler);
    };
  }, [ws, dispatch, t]);

  const handleSearchChange = useCallback(value => {
    setSearch(value);
  }, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  // --- Uninstall (existing ConfirmModal.Delete) ---
  const handleDelete = useCallback(extension => {
    deleteModalRef.current && deleteModalRef.current.open(extension);
  }, []);

  const handleDeleteAction = useCallback(
    async item => {
      setActionMap(prev => ({
        ...prev,
        [item.id]: t('admin:common.uninstalling', 'Uninstalling...'),
      }));
      try {
        await dispatch(uninstallExtension(item.id)).unwrap();
        dispatch(
          showSuccessMessage({
            message: t(
              'admin:extensions.uninstallSuccess',
              'Extension uninstalled successfully.',
            ),
          }),
        );
      } finally {
        setActionMap(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    },
    [dispatch, t],
  );

  // --- Activate ---
  const handleActivate = useCallback(extension => {
    activateModalRef.current && activateModalRef.current.open(extension);
  }, []);

  const handleActivateAction = useCallback(
    async item => {
      setActionMap(prev => ({
        ...prev,
        [item.id]: t('admin:common.activating', 'Activating...'),
      }));
      try {
        await dispatch(
          toggleExtensionStatus({ id: item.id, isActive: true }),
        ).unwrap();
        dispatch(
          showSuccessMessage({
            message: t(
              'admin:extensions.activateSuccess',
              'Extension activated successfully.',
            ),
          }),
        );
      } finally {
        setActionMap(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    },
    [dispatch, t],
  );

  // --- Deactivate ---
  const handleDeactivate = useCallback(extension => {
    deactivateModalRef.current && deactivateModalRef.current.open(extension);
  }, []);

  const handleDeactivateAction = useCallback(
    async item => {
      setActionMap(prev => ({
        ...prev,
        [item.id]: t('admin:common.deactivating', 'Deactivating...'),
      }));
      try {
        await dispatch(
          toggleExtensionStatus({ id: item.id, isActive: false }),
        ).unwrap();
        dispatch(
          showSuccessMessage({
            message: t(
              'admin:extensions.deactivateSuccess',
              'Extension deactivated successfully.',
            ),
          }),
        );
      } finally {
        setActionMap(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    },
    [dispatch, t],
  );

  // --- Install (Upload) ---
  const handleUploadClick = useCallback(() => {
    fileInputRef.current && fileInputRef.current.click();
  }, []);

  const handleFileChange = useCallback(event => {
    const file = event.target.files[0];
    if (file) {
      pendingFileRef.current = file;
      installModalRef.current &&
        installModalRef.current.open({ name: file.name });
    }
    // Reset input so the same file can be re-selected
    event.target.value = null;
  }, []);

  const handleInstallAction = useCallback(async () => {
    const file = pendingFileRef.current;
    if (!file) return;
    await dispatch(uploadExtension(file)).unwrap();
    pendingFileRef.current = null;
    dispatch(
      showSuccessMessage({
        message: t(
          'admin:extensions.installSuccess',
          'Extension installed successfully.',
        ),
      }),
    );
  }, [dispatch, t]);

  const handleInstallCancel = useCallback(() => {
    pendingFileRef.current = null;
  }, []);

  const handleUpgrade = useCallback(
    async extension => {
      try {
        await dispatch(
          upgradeExtension({ id: extension.id, data: {} }),
        ).unwrap();
      } catch (error) {
        console.error('Upgrade failed', error);
      }
    },
    [dispatch],
  );

  // Filter extensions
  const filteredExtensions = useMemo(
    () =>
      extensions.filter(
        p =>
          (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
          (p.key && p.key.toLowerCase().includes(search.toLowerCase())),
      ),
    [extensions, search],
  );

  if (!initialized || (loading && extensions.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='extension' size={24} />}
          title={t('admin:navigation.extensions', 'Extensions')}
          subtitle={t('admin:extensions.subtitle', 'Manage system extensions')}
        />
        <Loader variant='cards' />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='extension' size={24} />}
        title={t('admin:navigation.extensions', 'Extensions')}
        subtitle={t('admin:extensions.subtitle', 'Manage system extensions')}
      >
        <div className={s.headerActions}>
          <input
            type='file'
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept='.zip'
            onChange={handleFileChange}
          />
          <Button
            variant='primary'
            onClick={handleUploadClick}
            disabled={!canCreate || uploading}
          >
            <Icon name='plus' size={16} />
            {uploading
              ? t('admin:extensions.uploading', 'Uploading...')
              : t('admin:extensions.upload', 'Upload Extension')}
          </Button>
        </div>
      </Box.Header>

      <Table.SearchBar
        className={s.filters}
        value={search}
        onChange={handleSearchChange}
        placeholder={t('admin:extensions.search', 'Search extensions...')}
      />

      <div className={s.grid}>
        {filteredExtensions.map(extension => (
          <ExtensionCard
            key={extension.id}
            extension={extension}
            actionLabel={actionMap[extension.id]}
            activeDropdownId={activeDropdownId}
            onToggleDropdown={handleToggleDropdown}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            onUpgrade={handleUpgrade}
            onDelete={handleDelete}
            canUpdate={canUpdate}
          />
        ))}
      </div>

      {/* Uninstall confirmation */}
      <ConfirmModal.Delete
        ref={deleteModalRef}
        title={t('admin:extensions.uninstall', 'Uninstall Extension')}
        message={t(
          'admin:extensions.uninstall_message',
          'Are you sure you want to uninstall this extension? This will remove it from the database.',
        )}
        getItemName={p => p.name}
        onDelete={handleDeleteAction}
      />

      {/* Activate confirmation */}
      <ConfirmModal.Action
        ref={activateModalRef}
        title={t('admin:extensions.activate', 'Activate Extension')}
        getDescription={p =>
          t(
            'admin:extensions.activateConfirm',
            'Are you sure you want to activate "{{name}}"? The extension will start running immediately.',
            { name: p.name },
          )
        }
        onConfirm={handleActivateAction}
        confirmLabel={t('admin:common.activate', 'Activate')}
      />

      {/* Deactivate confirmation */}
      <ConfirmModal.Action
        ref={deactivateModalRef}
        title={t('admin:extensions.deactivate', 'Deactivate Extension')}
        getDescription={p =>
          t(
            'admin:extensions.deactivateConfirm',
            'Are you sure you want to deactivate "{{name}}"? The extension will stop running.',
            { name: p.name },
          )
        }
        onConfirm={handleDeactivateAction}
        confirmLabel={t('admin:common.deactivate', 'Deactivate')}
      />

      {/* Install confirmation */}
      <ConfirmModal.Action
        ref={installModalRef}
        title={t('admin:extensions.install', 'Install Extension')}
        getDescription={p =>
          t(
            'admin:extensions.installConfirm',
            'Are you sure you want to install "{{name}}"?',
            { name: p.name },
          )
        }
        onConfirm={handleInstallAction}
        onSuccess={handleInstallCancel}
        confirmLabel={t('admin:extensions.installButton', 'Install')}
      />
    </div>
  );
}

export default Extensions;
