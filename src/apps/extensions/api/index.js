/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getHmrState } from '@shared/utils/hmrState.js';
import { isSingletonWorker } from '@shared/utils/runtime.js';

import { registerSchedules } from './schedules.js';
import { sweepInstallTemps } from './services/extension.helpers.js';
import * as extensionService from './services/extension.service.js';
import { registerExtensionWorkers } from './services/extension.workers.js';

// Auto-load contexts
const migrationsContext = import.meta.webpackContext('./database/migrations', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const seedsContext = import.meta.webpackContext('./database/seeds', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const modelsContext = import.meta.webpackContext('./models', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const routesContext = import.meta.webpackContext('./routes', {
  recursive: true,
  regExp: /\.[cm]?[jt]s$/i,
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  migrations: () => migrationsContext,
  seeds: () => seedsContext,
  models: () => modelsContext,
  routes: () => routesContext,
  async boot({ container }) {
    registerExtensionWorkers(container);
    registerSchedules(container);
    reclaimAbandonedInstalls(container);
    if (process.env.NODE_ENV !== 'production') {
      registerHmrIpcListener(container);
    }
  },
};

/**
 * Remove install scratch directories a killed process left behind.
 *
 * Install and verify both clean up in a `finally`, which does not run when the
 * container is OOM-killed mid-download — and nothing else ever revisits those
 * paths, so each such death strands a package or a whole extracted tree under
 * os.tmpdir() permanently. One worker does this, not all of them, and it is
 * deliberately not awaited: boot must not wait on housekeeping, and a failure
 * here must not take the app down with it.
 *
 * @param {object} container - Application container
 */
function reclaimAbandonedInstalls(container) {
  if (!isSingletonWorker()) return;

  let extensionsDir = null;
  try {
    extensionsDir = container.resolve('extension').getInstalledExtensionsDir();
  } catch {
    // Rollback backups live beside the installed extensions; without that
    // directory the temp roots are still worth sweeping.
  }

  sweepInstallTemps({ extensionsDir })
    .then(removed => {
      if (removed > 0) {
        console.info(
          `[extensions] Reclaimed ${removed} abandoned install artifact(s)`,
        );
      }
    })
    .catch(error => {
      console.warn(
        `[extensions] Could not sweep abandoned installs: ${error.message}`,
      );
    });
}

/**
 * Registers an IPC message listener for local Webpack recompilations (HMR).
 * When `tools/tasks/extension.js` finishes rebuilding extension source code,
 * it broadcasts `extensions-refreshed`, instructing the backend to hot-reload
 * manifests and invalidate API caches.
 */
function registerHmrIpcListener(container) {
  // Initialize or retrieve global state to survive HMR module re-evaluations
  const state = getHmrState('extensions:ipc', () => ({
    isRefreshing: false,
    pendingIds: null,
    pendingExtensions: null,
    listener: null,
  }));

  // Clean up any existing listener from a previous HMR hot-reload
  if (state.listener) {
    process.removeListener('message', state.listener);
  }

  const processQueue = async () => {
    if (state.isRefreshing || (!state.pendingIds && !state.pendingExtensions))
      return;

    state.isRefreshing = true;

    // Capture the latest queued events and clear the queue
    const queuedIds = state.pendingIds || [];
    const queuedExtensions = state.pendingExtensions || [];
    state.pendingIds = null;
    state.pendingExtensions = null;

    const start = Date.now();
    console.log('🔌 Refreshing extensions...');
    try {
      const extensionIds = queuedIds.length > 0 ? queuedIds : queuedExtensions;
      await extensionService.refreshExtensions(extensionIds, {
        extensionManager: container.resolve('extension'),
        cache: container.resolve('cache'),
        models: container.resolve('models'),
      });
      const duration = Date.now() - start;
      console.log(`✅ Extensions refreshed in ${duration}ms`);
    } catch (err) {
      console.error('❌ Failed to refresh extensions via IPC:', err.message);
    } finally {
      state.isRefreshing = false;
      // If new events arrived while we were processing, process them now
      if (state.pendingIds || state.pendingExtensions) {
        processQueue();
      }
    }
  };

  state.listener = async msg => {
    if (msg && msg.type === 'extensions-refreshed') {
      // Merge incoming arrays into the pending queue
      if (Array.isArray(msg.ids)) {
        state.pendingIds = [
          ...new Set([...(state.pendingIds || []), ...msg.ids]),
        ];
      }
      if (Array.isArray(msg.extensions)) {
        state.pendingExtensions = [
          ...new Set([...(state.pendingExtensions || []), ...msg.extensions]),
        ];
      }

      processQueue();
    }
  };

  process.on('message', state.listener);
}
