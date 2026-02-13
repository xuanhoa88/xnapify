/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
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
import Card from '../../../../../shared/renderer/components/Card';
import Tag from '../../../../../shared/renderer/components/Tag';
import s from './Plugins.css';
import {
  fetchPlugins,
  uploadPlugin,
  upgradePlugin,
  togglePluginStatus,
  uninstallPlugin,
  getPlugins,
  isPluginsListLoading,
  isPluginUploading,
} from './redux';

function Plugins() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('plugins:create');
  const canUpdate = hasPermission('plugins:update');
  const canDelete = hasPermission('plugins:delete');

  const plugins = useSelector(getPlugins);
  const loading = useSelector(isPluginsListLoading);
  const uploading = useSelector(isPluginUploading);

  // Search state
  const [search, setSearch] = useState('');

  // Modals & Refs
  const deleteModalRef = useRef();
  const fileInputRef = useRef();

  useEffect(() => {
    dispatch(fetchPlugins());
  }, [dispatch]);

  const handleSearchChange = useCallback(value => {
    setSearch(value);
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
          // Refresh list logic is handled by reducer update or re-fetch?
          // Reducer updates the list optimistically or based on response.
          // slice.js updates list.
        } catch (error) {
          console.error('Upload failed', error);
          // TODO: Show toast error (global toast usually)
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
      } catch (error) {
        console.error('Toggle status failed', error);
      }
    },
    [dispatch],
  );

  const handleUpgrade = useCallback(
    async plugin => {
      try {
        await dispatch(upgradePlugin({ id: plugin.id })).unwrap();
      } catch (error) {
        console.error('Upgrade failed', error);
      }
    },
    [dispatch],
  );

  // Filter plugins
  const filteredPlugins = plugins.filter(
    p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.key.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading && plugins.length === 0) {
    return (
      <div className={s.root}>
        <Box.Header title={t('navigation.plugins', 'Plugins')} />
        <Loader variant='cards' />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
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
        value={search}
        onChange={handleSearchChange}
        placeholder='Search plugins...'
      />

      <div className={s.grid}>
        {filteredPlugins.map(plugin => (
          <Card key={plugin.id} className={s.card}>
            <Card.Header>
              <div className={s.cardTitle}>
                <h3>{plugin.name}</h3>
                <Tag variant={plugin.is_active ? 'success' : 'neutral'}>
                  {plugin.version}
                </Tag>
              </div>
              <div className={s.cardStatus}>
                {/* Toggle Switch - Using simple button/checkbox for now or specialized switch if available */}
                <label
                  className={s.switch}
                  disabled={!canUpdate}
                  aria-disabled={!canUpdate}
                  aria-label='Toggle plugin status'
                >
                  <input
                    type='checkbox'
                    checked={plugin.is_active}
                    disabled={!canUpdate}
                    onChange={e => handleToggleStatus(plugin, e.target.checked)}
                  />
                  <span className={s.slider}></span>
                </label>
              </div>
            </Card.Header>
            <Card.Body>
              <p className={s.description}>{plugin.description}</p>
              <div className={s.actions}>
                {canUpdate && (
                  <Button
                    size='small'
                    variant='ghost'
                    onClick={() => handleUpgrade(plugin)}
                  >
                    Upgrade
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size='small'
                    variant='ghost'
                    className={s.deleteBtn}
                    onClick={() => handleDelete(plugin)}
                  >
                    Uninstall
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
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
