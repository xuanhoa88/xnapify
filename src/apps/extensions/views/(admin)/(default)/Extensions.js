/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';

import { CubeIcon, PlusIcon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  SegmentedControl,
} from '@radix-ui/themes';
import debounce from 'lodash/debounce';
import toLower from 'lodash/toLower';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useDebounce } from '@shared/renderer/components/InfiniteScroll/index.js';
import Modal from '@shared/renderer/components/Modal/index.js';
import { useRbac } from '@shared/renderer/components/Rbac/index.js';
import { DataTable } from '@shared/renderer/components/Table/index.js';
import { features } from '@shared/renderer/redux/index.js';
import { useWebSocket } from '@shared/ws/client/index.js';

import ExtensionCard from './components/ExtensionCard.js';
import {
  fetchExtensions,
  uploadExtension,
  toggleExtensionStatus,
  uninstallExtension,
  getExtensions,
  isExtensionsListLoading,
  isExtensionUploading,
  isExtensionsInitialized,
} from './redux/index.js';

import s from './Extensions.css';

const { showSuccessMessage, showWarningMessage } = features;

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
  { key: 'all', labelKey: 'extensions:admin.filterAll', fallback: 'All' },
  {
    key: 'active',
    labelKey: 'extensions:admin.filterActive',
    fallback: 'Active',
  },
  {
    key: 'inactive',
    labelKey: 'extensions:admin.filterInactive',
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
  const [actionMap, setActionMap] = useState({});

  // Safety timeout timers — keyed by extension ID
  const actionTimersRef = useRef({});

  // Set an actionMap entry with a safety timeout that auto-clears it
  const setActionWithTimeout = useCallback(
    (id, label) => {
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
        // No completion event arrived in time (WebSocket down or the job is
        // wedged). Re-read the server state so the card stops guessing and
        // shows whatever actually happened.
        dispatch(fetchExtensions());
      }, ACTION_TIMEOUT_MS);
    },
    [dispatch],
  );

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

  const debouncedFetch = useMemo(
    () =>
      debounce(
        signal => {
          if (!signal.aborted) {
            dispatch(fetchExtensions({ signal }));
          }
        },
        500,
        { maxWait: 1000 },
      ),
    [dispatch],
  );

  useEffect(() => {
    return () => {
      debouncedFetch.cancel();
    };
  }, [debouncedFetch]);

  // Listen for background job completion via WebSocket to refresh extension list
  const ws = useWebSocket();
  useEffect(() => {
    if (!ws) return;
    const controller = new AbortController();
    const { signal } = controller;

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
                  'extensions:admin.installSuccess',
                  'Extension installed successfully.',
                ),
              }),
            );
          }
          // EXTENSION_UPDATED toast is handled inline in handleUpgrade —
          // no need to show it again from WS. The debouncedFetch below
          // still keeps other tabs/clients in sync.
          debouncedFetch(signal);
          break;
        }
        case 'EXTENSION_UNINSTALLED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          dispatch(
            showSuccessMessage({
              message: t(
                'extensions:admin.uninstallSuccess',
                'Extension uninstalled successfully.',
              ),
            }),
          );
          debouncedFetch(signal);
          break;
        }
        case 'EXTENSION_ACTIVATED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          dispatch(
            showSuccessMessage({
              message: t(
                'extensions:admin.activateSuccess',
                'Extension activated successfully.',
              ),
            }),
          );
          debouncedFetch(signal);
          break;
        }
        case 'EXTENSION_DEACTIVATED': {
          if (data.extensionId) {
            clearAction(data.extensionId);
          }
          dispatch(
            showSuccessMessage({
              message: t(
                'extensions:admin.deactivateSuccess',
                'Extension deactivated successfully.',
              ),
            }),
          );
          debouncedFetch(signal);
          break;
        }
        case 'EXTENSIONS_REFRESHED': {
          debouncedFetch(signal);
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
                'extensions:admin.operationFailed',
                'Extension operation failed. Please check the server logs for details.',
              ),
            }),
          );
          debouncedFetch(signal);
          break;
        }
        case 'EXTENSION_TAMPERED': {
          dispatch(
            showWarningMessage({
              message: t(
                'extensions:admin.tampered',
                'An extension failed integrity verification and has been deactivated for security.',
              ),
            }),
          );
          debouncedFetch(signal);
          break;
        }
        default:
          break;
      }
    };
    ws.on('extension:updated', handler);
    return () => {
      controller.abort();
      ws.off('extension:updated', handler);
    };
  }, [ws, dispatch, t, clearAction, debouncedFetch]);

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

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <DataTable
        as='grid'
        gridCols={3}
        dataSource={filteredExtensions}
        rowKey='id'
        loading={loading}
        initialized={initialized}
        renderCard={extension => (
          <ExtensionCard
            extension={extension}
            actionLabel={actionMap[extension.id]}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            onDelete={handleDelete}
            canUpdate={canUpdate}
          />
        )}
      >
        <DataTable.Header
          title={t('admin:navigation.extensions', 'Extensions')}
          subtitle={t('extensions:admin.subtitle', 'Manage system extensions')}
          icon={<CubeIcon width={24} height={24} />}
        >
          <Box
            as='input'
            type='file'
            ref={fileInputRef}
            className={s.hiddenFileInput}
            accept='.zip'
            onChange={handleFileChange}
          />

          <Button
            variant='solid'
            color='indigo'
            onClick={handleUploadClick}
            disabled={!canCreate || uploading}
          >
            <PlusIcon width={16} height={16} />
            {uploading
              ? t('extensions:admin.uploading', 'Uploading...')
              : t('extensions:admin.upload', 'Upload Extension')}
          </Button>
        </DataTable.Header>

        <DataTable.Toolbar justify='between'>
          <SegmentedControl.Root
            value={activeFilter}
            onValueChange={setActiveFilter}
            size='2'
          >
            {FILTER_TABS.map(tab => (
              <SegmentedControl.Item key={tab.key} value={tab.key}>
                <Flex align='center' gap='2'>
                  <Text as='span'>{t(tab.labelKey, tab.fallback)}</Text>
                  <Badge
                    variant={activeFilter === tab.key ? 'solid' : 'soft'}
                    color={activeFilter === tab.key ? 'indigo' : 'gray'}
                    radius='full'
                  >
                    {tabCounts[tab.key]}
                  </Badge>
                </Flex>
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>

          <DataTable.Search
            value={search}
            onChange={setSearch}
            placeholder={t('extensions:admin.search', 'Search extensions...')}
          />
        </DataTable.Toolbar>

        <DataTable.Empty
          icon={<CubeIcon width={48} height={48} />}
          title={
            search
              ? t(
                  'extensions:admin.noSearchResults',
                  'No extensions match your search',
                )
              : t(
                  'extensions:admin.noExtensionsInFilter',
                  'No extensions in this category',
                )
          }
          description={
            search
              ? t(
                  'extensions:admin.tryDifferentSearch',
                  'Try a different search term or clear the filter.',
                )
              : t(
                  'extensions:admin.tryDifferentFilter',
                  'Try selecting a different filter tab.',
                )
          }
        />

        <DataTable.Loader variant='cards' />
      </DataTable>

      {/* Uninstall confirmation */}
      <Modal.ConfirmDelete
        ref={deleteModalRef}
        title={t('extensions:admin.uninstall', 'Uninstall Extension')}
        message={t(
          'extensions:admin.uninstall_message',
          'Are you sure you want to uninstall this extension? This will remove it from the database.',
        )}
        getItemName={p => p.name}
        onDelete={handleDeleteAction}
      />

      {/* Activate confirmation */}
      <Modal.ConfirmAction
        ref={activateModalRef}
        title={t('extensions:admin.activate', 'Activate Extension')}
        getDescription={p =>
          t(
            'extensions:admin.activateConfirm',
            'Are you sure you want to activate "{{name}}"? The extension will start running immediately.',
            { name: p.name },
          )
        }
        onConfirm={handleActivateAction}
        confirmLabel={t('admin:common.activateBtn', 'Activate')}
      />

      {/* Deactivate confirmation */}
      <Modal.ConfirmAction
        ref={deactivateModalRef}
        title={t('extensions:admin.deactivate', 'Deactivate Extension')}
        getDescription={p =>
          t(
            'extensions:admin.deactivateConfirm',
            'Are you sure you want to deactivate "{{name}}"? The extension will stop running.',
            { name: p.name },
          )
        }
        onConfirm={handleDeactivateAction}
        confirmLabel={t('admin:common.deactivateBtn', 'Deactivate')}
      />

      {/* Install confirmation */}
      <Modal.ConfirmAction
        ref={installModalRef}
        title={t('extensions:admin.install', 'Install Extension')}
        getDescription={p =>
          t(
            'extensions:admin.installConfirm',
            'Are you sure you want to install "{{name}}"?',
            { name: p.name },
          )
        }
        onConfirm={handleInstallAction}
        onSuccess={handleInstallCancel}
        confirmLabel={t('extensions:admin.installButton', 'Install')}
      />
    </Box>
  );
}

export default Extensions;
