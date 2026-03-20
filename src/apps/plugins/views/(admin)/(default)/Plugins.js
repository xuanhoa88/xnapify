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

import PluginCard from './components/PluginCard';
import {
  fetchPlugins,
  uploadPlugin,
  upgradePlugin,
  togglePluginStatus,
  uninstallPlugin,
  getPlugins,
  isPluginsListLoading,
  isPluginUploading,
  isPluginsInitialized,
} from './redux';

import s from './Plugins.css';

function Plugins() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('plugins:create');
  const canUpdate = hasPermission('plugins:update');

  const plugins = useSelector(getPlugins);
  const loading = useSelector(isPluginsListLoading);
  const uploading = useSelector(isPluginUploading);
  const initialized = useSelector(isPluginsInitialized);

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
    dispatch(fetchPlugins());
  }, [dispatch]);

  // Listen for background job completion via WebSocket to refresh plugin list
  const ws = useWebSocket();
  useEffect(() => {
    if (!ws) return;
    const handler = data => {
      if (!data) return;
      switch (data.type) {
        case 'PLUGIN_INSTALLED':
        case 'PLUGIN_UPDATED':
        case 'PLUGIN_UNINSTALLED': {
          dispatch(fetchPlugins());
          if (data.pluginId) {
            setActionMap(prev => {
              if (!(data.pluginId in prev)) return prev;
              const next = { ...prev };
              delete next[data.pluginId];
              return next;
            });
          }
          break;
        }
        case 'PLUGIN_TAMPERED': {
          dispatch(fetchPlugins());
          dispatch(
            showWarningMessage({
              message: t(
                'admin:plugins.tampered',
                'A plugin failed integrity verification and has been deactivated for security.',
              ),
            }),
          );
          break;
        }
        default:
          break;
      }
    };
    ws.on('plugin:updated', handler);
    return () => {
      ws.off('plugin:updated', handler);
    };
  }, [ws, dispatch, t]);

  const handleSearchChange = useCallback(value => {
    setSearch(value);
  }, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  // --- Uninstall (existing ConfirmModal.Delete) ---
  const handleDelete = useCallback(plugin => {
    deleteModalRef.current && deleteModalRef.current.open(plugin);
  }, []);

  const handleDeleteAction = useCallback(
    async item => {
      setActionMap(prev => ({
        ...prev,
        [item.id]: t('admin:common.uninstalling', 'Uninstalling...'),
      }));
      try {
        await dispatch(uninstallPlugin(item.id)).unwrap();
        dispatch(
          showSuccessMessage({
            message: t(
              'admin:plugins.uninstallSuccess',
              'Plugin uninstalled successfully.',
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
  const handleActivate = useCallback(plugin => {
    activateModalRef.current && activateModalRef.current.open(plugin);
  }, []);

  const handleActivateAction = useCallback(
    async item => {
      setActionMap(prev => ({
        ...prev,
        [item.id]: t('admin:common.activating', 'Activating...'),
      }));
      try {
        await dispatch(
          togglePluginStatus({ id: item.id, isActive: true }),
        ).unwrap();
        dispatch(
          showSuccessMessage({
            message: t(
              'admin:plugins.activateSuccess',
              'Plugin activated successfully.',
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
  const handleDeactivate = useCallback(plugin => {
    deactivateModalRef.current && deactivateModalRef.current.open(plugin);
  }, []);

  const handleDeactivateAction = useCallback(
    async item => {
      setActionMap(prev => ({
        ...prev,
        [item.id]: t('admin:common.deactivating', 'Deactivating...'),
      }));
      try {
        await dispatch(
          togglePluginStatus({ id: item.id, isActive: false }),
        ).unwrap();
        dispatch(
          showSuccessMessage({
            message: t(
              'admin:plugins.deactivateSuccess',
              'Plugin deactivated successfully.',
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
    await dispatch(uploadPlugin(file)).unwrap();
    pendingFileRef.current = null;
    dispatch(
      showSuccessMessage({
        message: t(
          'admin:plugins.installSuccess',
          'Plugin installed successfully.',
        ),
      }),
    );
  }, [dispatch, t]);

  const handleInstallCancel = useCallback(() => {
    pendingFileRef.current = null;
  }, []);

  const handleUpgrade = useCallback(
    async plugin => {
      try {
        await dispatch(upgradePlugin({ id: plugin.id, data: {} })).unwrap();
      } catch (error) {
        console.error('Upgrade failed', error);
      }
    },
    [dispatch],
  );

  // Filter plugins
  const filteredPlugins = useMemo(
    () =>
      plugins.filter(
        p =>
          (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
          (p.key && p.key.toLowerCase().includes(search.toLowerCase())),
      ),
    [plugins, search],
  );

  if (!initialized || (loading && plugins.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='extension' size={24} />}
          title={t('admin:navigation.plugins', 'Plugins')}
          subtitle={t('admin:plugins.subtitle', 'Manage system plugins')}
        />
        <Loader variant='cards' />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='extension' size={24} />}
        title={t('admin:navigation.plugins', 'Plugins')}
        subtitle={t('admin:plugins.subtitle', 'Manage system plugins')}
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
              ? t('admin:plugins.uploading', 'Uploading...')
              : t('admin:plugins.upload', 'Upload Plugin')}
          </Button>
        </div>
      </Box.Header>

      <Table.SearchBar
        className={s.filters}
        value={search}
        onChange={handleSearchChange}
        placeholder={t('admin:plugins.search', 'Search plugins...')}
      />

      <div className={s.grid}>
        {filteredPlugins.map(plugin => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            actionLabel={actionMap[plugin.id]}
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
        title={t('admin:plugins.uninstall', 'Uninstall Plugin')}
        message={t(
          'admin:plugins.uninstall_message',
          'Are you sure you want to uninstall this plugin? This will remove it from the database.',
        )}
        getItemName={p => p.name}
        onDelete={handleDeleteAction}
      />

      {/* Activate confirmation */}
      <ConfirmModal.Action
        ref={activateModalRef}
        title={t('admin:plugins.activate', 'Activate Plugin')}
        getDescription={p =>
          t(
            'admin:plugins.activateConfirm',
            'Are you sure you want to activate "{{name}}"? The plugin will start running immediately.',
            { name: p.name },
          )
        }
        onConfirm={handleActivateAction}
        confirmLabel={t('admin:common.activate', 'Activate')}
      />

      {/* Deactivate confirmation */}
      <ConfirmModal.Action
        ref={deactivateModalRef}
        title={t('admin:plugins.deactivate', 'Deactivate Plugin')}
        getDescription={p =>
          t(
            'admin:plugins.deactivateConfirm',
            'Are you sure you want to deactivate "{{name}}"? The plugin will stop running.',
            { name: p.name },
          )
        }
        onConfirm={handleDeactivateAction}
        confirmLabel={t('admin:common.deactivate', 'Deactivate')}
      />

      {/* Install confirmation */}
      <ConfirmModal.Action
        ref={installModalRef}
        title={t('admin:plugins.install', 'Install Plugin')}
        getDescription={p =>
          t(
            'admin:plugins.installConfirm',
            'Are you sure you want to install "{{name}}"?',
            { name: p.name },
          )
        }
        onConfirm={handleInstallAction}
        onSuccess={handleInstallCancel}
        confirmLabel={t('admin:plugins.installButton', 'Install')}
      />
    </div>
  );
}

export default Plugins;
