/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as extensionService from './services/extension.service';
import { registerExtensionWorkers } from './services/extension.workers';

// Auto-load contexts
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

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

    if (process.env.NODE_ENV !== 'production') {
      registerHmrIpcListener(container);
    }
  },
};

/**
 * Registers an IPC message listener for local Webpack recompilations (HMR).
 * When `tools/tasks/extension.js` finishes rebuilding extension source code,
 * it broadcasts `extensions-refreshed`, instructing the backend to hot-reload
 * manifests and invalidate API caches.
 */
const IPC_LISTENER_KEY = Symbol.for('__xnapify.extension.hmr.ipcListener__');

function registerHmrIpcListener(container) {
  // Clean up any existing listener from a previous HMR hot-reload
  // Since require.cache is cleared during full reloads, a module-scoped
  // variable would reset to null, causing a memory leak of detached listeners.
  // We use a global symbol to ensure the old listener is found and removed.
  if (global[IPC_LISTENER_KEY]) {
    process.removeListener('message', global[IPC_LISTENER_KEY]);
  }

  let isRefreshing = false;

  const activeIpcListener = async msg => {
    if (msg && msg.type === 'extensions-refreshed') {
      if (isRefreshing) return;

      isRefreshing = true;
      const start = Date.now();
      console.log('🔌 Refreshing all extensions...');

      try {
        const extensionIds = Array.isArray(msg.extensions)
          ? msg.extensions
          : [];

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
        isRefreshing = false;
      }
    }
  };

  global[IPC_LISTENER_KEY] = activeIpcListener;
  process.on('message', activeIpcListener);
}
