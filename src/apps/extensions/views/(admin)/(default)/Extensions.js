/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';

import clsx from 'clsx';
import toLower from 'lodash/toLower';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import Icon from '@shared/renderer/components/Icon';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
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

/**
 * Safety timeout for actionMap entries (ms).
 * If no WebSocket event clears the label within this window, auto-clear it
 * to prevent the UI from being permanently stuck on "Activating..."/"Deactivating...".
 */
const ACTION_TIMEOUT_MS = 120_000;

/**
 * Filter tab definitions
 */
const FILTER_TABS = [
  { key: 'all', labelKey: 'admin:extensions.filterAll', fallback: 'All' },
  {
    key: 'active',
    labelKey: 'admin:extensions.filterActive',
    fallback: 'Active',
  },
  {
    key: 'inactive',
    labelKey: 'admin:extensions.filterInactive',
    fallback: 'Inactive',
  },
];

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

  // Search & filter state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [actionMap, setActionMap] = useState({});

  // Safety timeout timers — keyed by extension ID
  const actionTimersRef = useRef({});

  // Set an actionMap entry with a safety timeout that auto-clears it
  const setActionWithTimeout = useCallback((id, label) => {
    setActionMap(prev => ({ ...prev, [id]: label }));

    // Cancel any existing timer for this ID
    if (actionTimersRef.current[id]) {
      clearTimeout(actionTimersRef.current[id]);
    }

    actionTimersRef.current[id] = setTimeout(() => {
      setActionMap(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete actionTimersRef.current[id];
    }, ACTION_TIMEOUT_MS);
  }, []);

  // Clear an actionMap entry and its safety timer
  const clearAction = useCallback(id => {
    if (actionTimersRef.current[id]) {
      clearTimeout(actionTimersRef.current[id]);
      delete actionTimersRef.current[id];
    }
    setActionMap(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = actionTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

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

  // Track which extensions were last seen WITH a job_status so the
  // reconciliation effect can detect the transition "had status → no status"
  // instead of blindly clearing entries that never had status at all.
  const prevJobStatusRef = useRef({});

  // Reconcile actionMap with fetched data — clear an actionMap entry only
  // when an extension *previously had* a job_status that has now disappeared
  // (meaning the job completed between fetches). This prevents premature
  // clearing caused by thunk fulfilled handlers storing extensions without
  // job_status while other extensions still have pending jobs.
  useEffect(() => {
    // Build current job_status snapshot
    const currentStatus = {};
    for (const ext of extensions) {
      if (ext.job_status) {
        currentStatus[ext.id] = ext.job_status;
      }
    }

    setActionMap(prev => {
      const ids = Object.keys(prev);
      if (ids.length === 0) {
        prevJobStatusRef.current = currentStatus;
        return prev;
      }

      let changed = false;
      const next = { ...prev };
      for (const id of ids) {
        const ext = extensions.find(e => e.id === id);
        // Only clear if this extension previously HAD a job_status
        // and now no longer does — that means the job finished.
        const hadStatus = prevJobStatusRef.current[id];
        if (ext && hadStatus && !ext.job_status) {
          delete next[id];
          if (actionTimersRef.current[id]) {
            clearTimeout(actionTimersRef.current[id]);
            delete actionTimersRef.current[id];
          }
          changed = true;
        }
      }

      prevJobStatusRef.current = currentStatus;
      return changed ? next : prev;
    });
  }, [extensions]);

  // Listen for background job completion via WebSocket to refresh extension list
  const ws = useWebSocket();
  useEffect(() => {
    if (!ws) return;
    const controller = new AbortController();
    const { signal } = controller;
    let debounceTimer = null;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!signal.aborted) {
          dispatch(fetchExtensions({ signal }));
        }
      }, 500);
    };

    const handler = async data => {
      if (!data || signal.aborted) return;
      switch (data.type) {
        case 'EXTENSION_INSTALLED':
        case 'EXTENSION_UPDATED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          if (data.type === 'EXTENSION_INSTALLED') {
            dispatch(
              showSuccessMessage({
                message: t(
                  'admin:extensions.installSuccess',
                  'Extension installed successfully.',
                ),
              }),
            );
          }
          // EXTENSION_UPDATED toast is handled inline in handleUpgrade —
          // no need to show it again from WS. The debouncedFetch below
          // still keeps other tabs/clients in sync.
          debouncedFetch();
          break;
        }
        case 'EXTENSION_UNINSTALLED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          dispatch(
            showSuccessMessage({
              message: t(
                'admin:extensions.uninstallSuccess',
                'Extension uninstalled successfully.',
              ),
            }),
          );
          debouncedFetch();
          break;
        }
        case 'EXTENSION_ACTIVATED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          dispatch(
            showSuccessMessage({
              message: t(
                'admin:extensions.activateSuccess',
                'Extension activated successfully.',
              ),
            }),
          );
          debouncedFetch();
          break;
        }
        case 'EXTENSION_DEACTIVATED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          dispatch(
            showSuccessMessage({
              message: t(
                'admin:extensions.deactivateSuccess',
                'Extension deactivated successfully.',
              ),
            }),
          );
          debouncedFetch();
          break;
        }
        case 'EXTENSION_INSTALL_FAILED':
        case 'EXTENSION_ACTIVATE_FAILED':
        case 'EXTENSION_DEACTIVATE_FAILED':
        case 'EXTENSION_UNINSTALL_FAILED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          dispatch(
            showWarningMessage({
              message: t(
                'admin:extensions.operationFailed',
                'Extension operation failed. Please check the server logs for details.',
              ),
            }),
          );
          debouncedFetch();
          break;
        }
        case 'EXTENSION_TAMPERED': {
          dispatch(
            showWarningMessage({
              message: t(
                'admin:extensions.tampered',
                'An extension failed integrity verification and has been deactivated for security.',
              ),
            }),
          );
          debouncedFetch();
          break;
        }
        default:
          break;
      }
    };
    ws.on('extension:updated', handler);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      controller.abort();
      ws.off('extension:updated', handler);
    };
  }, [ws, dispatch, t, clearAction]);

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
      if (actionMap[item.id]) return;
      setActionWithTimeout(
        item.id,
        t('admin:common.uninstalling', 'Uninstalling...'),
      );
      try {
        await dispatch(uninstallExtension(item.id)).unwrap();
        // Success toast deferred to WebSocket EXTENSION_UNINSTALLED handler
      } catch {
        clearAction(item.id);
      }
    },
    [actionMap, dispatch, t, setActionWithTimeout, clearAction],
  );

  // --- Activate ---
  const handleActivate = useCallback(extension => {
    activateModalRef.current && activateModalRef.current.open(extension);
  }, []);

  const handleActivateAction = useCallback(
    async item => {
      if (actionMap[item.id]) return;
      setActionWithTimeout(
        item.id,
        t('admin:common.activating', 'Activating...'),
      );
      try {
        await dispatch(
          toggleExtensionStatus({ id: item.id, isActive: true }),
        ).unwrap();
        // Success toast deferred to WebSocket EXTENSION_ACTIVATED handler
      } catch {
        clearAction(item.id);
      }
    },
    [actionMap, dispatch, t, setActionWithTimeout, clearAction],
  );

  // --- Deactivate ---
  const handleDeactivate = useCallback(extension => {
    deactivateModalRef.current && deactivateModalRef.current.open(extension);
  }, []);

  const handleDeactivateAction = useCallback(
    async item => {
      if (actionMap[item.id]) return;
      setActionWithTimeout(
        item.id,
        t('admin:common.deactivating', 'Deactivating...'),
      );
      try {
        await dispatch(
          toggleExtensionStatus({ id: item.id, isActive: false }),
        ).unwrap();
        // Success toast deferred to WebSocket EXTENSION_DEACTIVATED handler
      } catch {
        clearAction(item.id);
      }
    },
    [actionMap, dispatch, t, setActionWithTimeout, clearAction],
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
    try {
      await dispatch(uploadExtension(file)).unwrap();
      pendingFileRef.current = null;
    } catch {
      pendingFileRef.current = null;
      // Errors are handled by the upload thunk and UI state; avoid unhandled rejection.
    }
    // Success toast deferred to WebSocket EXTENSION_INSTALLED handler
  }, [dispatch]);

  const handleInstallCancel = useCallback(() => {
    pendingFileRef.current = null;
  }, []);

  const handleUpgrade = useCallback(
    async extension => {
      if (actionMap[extension.id]) return;
      setActionWithTimeout(
        extension.id,
        t('admin:common.upgrading', 'Upgrading...'),
      );
      try {
        await dispatch(
          upgradeExtension({ id: extension.id, data: {} }),
        ).unwrap();
        // Upgrade is synchronous (no queue job) — show feedback immediately
        clearAction(extension.id);
        dispatch(
          showSuccessMessage({
            message: t(
              'admin:extensions.upgradeSuccess',
              'Extension upgraded successfully.',
            ),
          }),
        );
      } catch {
        clearAction(extension.id);
      }
    },
    [actionMap, dispatch, t, setActionWithTimeout, clearAction],
  );

  // Count per tab for badges
  const tabCounts = useMemo(() => {
    let activeCount = 0;
    for (let i = 0; i < extensions.length; i++) {
      if (extensions[i].is_active) activeCount++;
    }
    return {
      all: extensions.length,
      active: activeCount,
      inactive: extensions.length - activeCount,
    };
  }, [extensions]);

  // Filter extensions by tab and search
  const filteredExtensions = useMemo(() => {
    let result = extensions;

    // Apply tab filter
    if (activeFilter === 'active') {
      result = result.filter(p => p.is_active);
    } else if (activeFilter === 'inactive') {
      result = result.filter(p => !p.is_active);
    }

    // Apply search (debounced to avoid filtering on every keystroke)
    if (debouncedSearch) {
      const lowerSearch = toLower(debouncedSearch);
      result = result.filter(p => {
        return (
          (p.name && toLower(p.name).indexOf(lowerSearch) !== -1) ||
          (p.key && toLower(p.key).indexOf(lowerSearch) !== -1)
        );
      });
    }

    return result;
  }, [extensions, activeFilter, debouncedSearch]);

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

      {/* Toolbar: Filter Tabs + Search */}
      <div className={clsx(s.toolbar, 'extensions-toolbar')}>
        <div className={s.filterTabs}>
          {FILTER_TABS.map(tab => (
            <Button
              key={tab.key}
              type='button'
              className={clsx(s.filterTab, {
                [s.filterTabActive]: activeFilter === tab.key,
              })}
              onClick={() => setActiveFilter(tab.key)}
            >
              {t(tab.labelKey, tab.fallback)}
              <span className={s.filterTabCount}>{tabCounts[tab.key]}</span>
            </Button>
          ))}
        </div>

        <div className={s.searchContainer}>
          <Table.SearchBar
            className={s.searchBar}
            value={search}
            onChange={handleSearchChange}
            placeholder={t('admin:extensions.search', 'Search extensions...')}
          />
        </div>
      </div>

      {filteredExtensions.length === 0 ? (
        <div className={s.emptyState}>
          <Icon name='extension' size={48} />
          <p className={s.emptyTitle}>
            {search
              ? t(
                  'admin:extensions.noSearchResults',
                  'No extensions match your search',
                )
              : t(
                  'admin:extensions.noExtensionsInFilter',
                  'No extensions in this category',
                )}
          </p>
          <p className={s.emptySubtitle}>
            {search
              ? t(
                  'admin:extensions.tryDifferentSearch',
                  'Try a different search term or clear the filter.',
                )
              : t(
                  'admin:extensions.tryDifferentFilter',
                  'Try selecting a different filter tab.',
                )}
          </p>
        </div>
      ) : (
        <div className={clsx(s.grid, 'card-grid')}>
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
      )}

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
