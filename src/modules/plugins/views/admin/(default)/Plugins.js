/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useRbac } from '../../../../../shared/renderer/components/Rbac';
import {
  Box,
  Icon,
  Loader,
  Table,
  ConfirmModal,
} from '../../../../../shared/renderer/components/Admin';
import Button from '../../../../../shared/renderer/components/Button';
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

  // Modals & Refs
  const deleteModalRef = useRef();
  const fileInputRef = useRef();

  useEffect(() => {
    dispatch(fetchPlugins());
  }, [dispatch]);

  const handleSearchChange = useCallback(value => {
    setSearch(value);
  }, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  const handleDelete = useCallback(plugin => {
    deleteModalRef.current && deleteModalRef.current.open(plugin);
  }, []);

  const handleDeleteAction = useCallback(
    async item => {
      await dispatch(uninstallPlugin(item.id)).unwrap();
    },
    [dispatch],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current && fileInputRef.current.click();
  }, []);

  const handleFileChange = useCallback(
    async event => {
      const file = event.target.files[0];
      if (file) {
        try {
          await dispatch(uploadPlugin(file)).unwrap();
          // Reset input
          event.target.value = null;
        } catch (error) {
          console.error('Upload failed', error);
        }
      }
    },
    [dispatch],
  );

  const handleToggleStatus = useCallback(
    async (plugin, isActive) => {
      try {
        await dispatch(
          togglePluginStatus({ id: plugin.id, isActive }),
        ).unwrap();
        dispatch(fetchPlugins());
      } catch (error) {
        console.error('Toggle status failed', error);
      }
    },
    [dispatch],
  );

  const handleUpgrade = useCallback(
    async plugin => {
      try {
        await dispatch(upgradePlugin({ id: plugin.id, data: {} })).unwrap();
        dispatch(fetchPlugins());
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
          title={t('navigation.plugins', 'Plugins')}
          subtitle='Manage system plugins'
        />
        <Loader variant='cards' />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='extension' size={24} />}
        title={t('navigation.plugins', 'Plugins')}
        subtitle='Manage system plugins'
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
            {uploading ? 'Uploading...' : 'Upload Plugin'}
          </Button>
        </div>
      </Box.Header>

      <Table.SearchBar
        className={s.filters}
        value={search}
        onChange={handleSearchChange}
        placeholder='Search plugins...'
      />

      <div className={s.grid}>
        {filteredPlugins.map(plugin => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            activeDropdownId={activeDropdownId}
            onToggleDropdown={handleToggleDropdown}
            onToggleStatus={handleToggleStatus}
            onUpgrade={handleUpgrade}
            onDelete={handleDelete}
            canUpdate={canUpdate}
          />
        ))}
      </div>

      <ConfirmModal.Delete
        ref={deleteModalRef}
        title='Uninstall Plugin'
        message='Are you sure you want to uninstall this plugin? This will remove it from the database.'
        getItemName={p => p.name}
        onDelete={handleDeleteAction}
      />
    </div>
  );
}

export default Plugins;
