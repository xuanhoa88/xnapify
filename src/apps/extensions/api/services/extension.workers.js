/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import workerPool from '../workers';

import {
  installExtensionDependencies,
  notifyExtensionChange,
  resolveExtension,
} from './extension.helpers';

// ========================================================================
// Individual Worker Handlers
// ========================================================================

/**
 * Handle the "install" job for an extension.
 *
 * @param {Object} container - DI container instance
 * @param {Object} job - Queue job
 */
async function handleInstallJob(container, job) {
  const { extensionDir, extensionKey, actorId } = job.data;

  try {
    const extensionManager = container.resolve('extension');
    const hook = container.resolve('hook');

    job.updateProgress(10);
    await installExtensionDependencies(extensionDir, {
      name: extensionKey,
    });
    job.updateProgress(50);

    // Compute integrity hash in worker thread (avoids blocking event loop)
    const integrity = await workerPool.computeChecksum(extensionDir);
    const { Extension } = container.resolve('models');
    await Extension.update({ integrity }, { where: { key: extensionKey } });
    job.updateProgress(60);

    if (extensionManager) {
      // Run one-time install hook (e.g. persistent config, initial setup)
      // Extension stays inactive — admin must manually activate.
      const manifest = await extensionManager.readManifest(extensionDir);
      if (manifest) {
        await extensionManager.installExtension(extensionKey, manifest);
      }
    }
    job.updateProgress(90);

    if (hook) {
      hook('admin:extensions').emit('installed', {
        extension_id: extensionKey,
        actor_id: actorId,
        data: { path: extensionDir, integrity },
      });
    }

    job.updateProgress(100);
    return { success: true, notifyType: 'EXTENSION_INSTALLED', extensionKey };
  } catch (err) {
    console.error(`[ExtensionWorker] Install failed for ${extensionKey}:`, err);
    throw err;
  }
}

/**
 * Handle the "delete" job for an extension.
 *
 * @param {Object} container - DI container instance
 * @param {Object} job - Queue job
 */
async function handleDeleteJob(container, job) {
  const { extensionKey, actorId } = job.data;

  try {
    const cwd = container.resolve('cwd');
    const extensionManager = container.resolve('extension');
    const hook = container.resolve('hook');
    const { Extension } = container.resolve('models');

    if (extensionManager) {
      // 1. Unload → deactivate via event chain (extension:unloaded → deactivateExtension)
      //    Must happen first: uninstall requires a non-active extension.
      if (extensionManager.isExtensionLoaded(extensionKey)) {
        await extensionManager.unloadExtension(extensionKey);
      }

      // 2. Run one-time uninstall hook (reverts seeds, migrations, cleanup)
      const metadata = extensionManager.getExtensionMetadata(extensionKey);
      const manifest = metadata && metadata.manifest;
      if (manifest) {
        await extensionManager.uninstallExtension(extensionKey, manifest);
      }
    }

    // Remove files from both directories (with path traversal guard)
    if (cwd && extensionManager) {
      const dirs = [
        extensionManager.getInstalledExtensionsDir(),
        extensionManager.getDevExtensionsDir(cwd),
      ].filter(Boolean);
      for (const baseDir of dirs) {
        try {
          const pDir = path.join(baseDir, extensionKey);
          const relative = path.relative(baseDir, pDir);
          if (
            relative &&
            !relative.startsWith('..') &&
            !path.isAbsolute(relative)
          ) {
            await fs.promises.rm(pDir, { recursive: true, force: true });
          }
        } catch {
          // Non-fatal — directory may not exist
        }
      }
    }

    await Extension.destroy({ where: { key: extensionKey } });

    if (hook) {
      hook('admin:extensions').emit('deleted', {
        extension_id: extensionKey,
        actor_id: actorId,
        data: { key: extensionKey },
      });
    }

    return { success: true, notifyType: 'EXTENSION_UNINSTALLED', extensionKey };
  } catch (err) {
    console.error(`[ExtensionWorker] Delete failed for ${extensionKey}:`, err);
    throw err;
  }
}

/**
 * Handle the "toggle" job for an extension.
 *
 * @param {Object} container - DI container instance
 * @param {Object} job - Queue job
 */
async function handleToggleJob(container, job) {
  const { extensionKey, isActive, actorId, extensionDir, isDevExtension } =
    job.data;

  try {
    const extensionManager = container.resolve('extension');
    const hook = container.resolve('hook');
    const models = container.resolve('models');

    // Security: verify integrity before activating (skip for dev extensions)
    if (isActive && extensionDir && !isDevExtension) {
      const { extension: dbExtension } = await resolveExtension(
        models,
        extensionKey,
        { required: false },
      );
      if (dbExtension && dbExtension.integrity) {
        // Verify integrity in worker thread (avoids blocking event loop)
        const { valid, actual } = await workerPool.verifyChecksum(
          extensionDir,
          dbExtension.integrity,
        );
        if (!valid) {
          console.error(
            `[ExtensionWorker] ⛔ Integrity verification FAILED for extension ${extensionKey}. ` +
              `Expected: ${dbExtension.integrity}, Got: ${actual}. ` +
              `Refusing to activate — possible code injection detected.`,
          );
          await dbExtension.update({ is_active: false });
          notifyExtensionChange(container, 'EXTENSION_TAMPERED', extensionKey);
          return { success: false, reason: 'integrity_mismatch' };
        }
      }
    }

    if (extensionDir && isActive) {
      await installExtensionDependencies(extensionDir, { name: extensionKey });

      // Recompute integrity hash in worker thread after fresh npm install
      const integrity = await workerPool.computeChecksum(extensionDir);
      await models.Extension.update(
        { integrity },
        { where: { key: extensionKey } },
      );
    }

    if (extensionManager) {
      if (isActive) {
        if (extensionManager.isExtensionLoaded(extensionKey)) {
          await extensionManager.reloadExtension(extensionKey);
        } else if (extensionDir) {
          // Extension was never loaded — read manifest from disk
          const manifest = await extensionManager.readManifest(extensionDir);
          if (manifest) {
            manifest.fromDisk = true;
            await extensionManager.loadExtension(extensionKey, manifest);
          }
        }
      } else {
        if (extensionManager.isExtensionLoaded(extensionKey)) {
          await extensionManager.unloadExtension(extensionKey);
        } else {
          await extensionManager.emit('extension:unloaded', {
            id: extensionKey,
          });
        }
      }
    }

    if (hook) {
      hook('admin:extensions').emit('status_changed', {
        extension_id: extensionKey,
        actor_id: actorId,
        data: { isActive },
      });
    }

    return {
      success: true,
      notifyType: isActive ? 'EXTENSION_ACTIVATED' : 'EXTENSION_DEACTIVATED',
      extensionKey,
    };
  } catch (err) {
    console.error(`[ExtensionWorker] Toggle failed for ${extensionKey}:`, err);
    throw err;
  }
}

// ========================================================================
// Registration
// ========================================================================

/**
 * Reconcile extension states on boot.
 * Recovers from crash scenarios where the DB says is_active=true but the
 * extension was never actually loaded (e.g. server crashed during a toggle job).
 *
 * @param {Object} container - DI container instance
 * @param {Object} queueChannel - Queue channel for 'extensions'
 */
async function reconcileExtensionStates(container, queueChannel) {
  try {
    const extensionManager = container.resolve('extension');
    const models = container.resolve('models');
    if (!extensionManager || !models) return;

    const { Extension } = models;
    const activeExtensions = await Extension.findAll({
      where: { is_active: true },
    });

    // Collect IDs of extensions with active queue jobs (skip those)
    const busyKeys = new Set();
    if (
      queueChannel.queue &&
      typeof queueChannel.queue.getJobs === 'function'
    ) {
      const allJobs = await queueChannel.queue.getJobs();
      for (const job of allJobs) {
        if (['pending', 'active', 'delayed'].includes(job.status)) {
          if (job.data && job.data.extensionKey) {
            busyKeys.add(job.data.extensionKey);
          }
        }
      }
    }

    for (const ext of activeExtensions) {
      if (busyKeys.has(ext.key)) continue;

      if (!extensionManager.isExtensionLoaded(ext.key)) {
        await ext.update({ is_active: false });
        console.warn(
          `[ExtensionWorker] Reconciled stale is_active for ${ext.key} — extension not loaded`,
        );
      }
    }
  } catch (err) {
    console.error('[ExtensionWorker] Boot reconciliation failed:', err);
  }
}

/**
 * Register background workers for extension tasks.
 * Called during server initialization.
 *
 * @param {Object} container - DI container instance
 */
export function registerExtensionWorkers(container) {
  const queue = container.resolve('queue');
  const queueChannel = queue('extensions');

  // Register event handlers for extension tasks
  queueChannel.on('install', job => handleInstallJob(container, job));
  queueChannel.on('delete', job => handleDeleteJob(container, job));
  queueChannel.on('toggle', job => handleToggleJob(container, job));

  // Assert queue adapter is available — fail loudly during boot rather than
  // silently dropping all completed/failed events (which causes permanent
  // "state frozen" in the UI).
  if (!queueChannel.queue) {
    console.error(
      '[ExtensionWorker] ⚠️ Queue adapter not available — completed/failed handlers NOT registered. ' +
        'Extension lifecycle WS notifications will not work.',
    );
  } else {
    // Send WS notifications AFTER job is fully processed and removed from queue.
    // This prevents a race where the frontend re-fetches the list while the job
    // is still active, causing the server to return a stale job_status.
    queueChannel.queue.on('completed', (job, result) => {
      if (result && result.notifyType && result.extensionKey) {
        notifyExtensionChange(
          container,
          result.notifyType,
          result.extensionKey,
        );
      }
    });

    queueChannel.queue.on('failed', async job => {
      const { extensionKey, isActive } = job.data || {};
      if (!extensionKey) return;

      // Revert DB status on failed toggle to keep it consistent
      if (job.name === 'toggle') {
        try {
          const models = container.resolve('models');
          await models.Extension.update(
            { is_active: !isActive },
            { where: { key: extensionKey } },
          );
          console.warn(
            `[ExtensionWorker] Reverted is_active for ${extensionKey} after failed toggle`,
          );
        } catch (revertErr) {
          console.error(
            `[ExtensionWorker] Failed to revert DB status for ${extensionKey}:`,
            revertErr,
          );
        }
      }

      // Clean up orphaned DB record on install failure
      if (job.name === 'install') {
        try {
          const models = container.resolve('models');
          await models.Extension.destroy({ where: { key: extensionKey } });
          console.warn(
            `[ExtensionWorker] Cleaned up DB record for ${extensionKey} after failed install`,
          );
        } catch (cleanupErr) {
          console.error(
            `[ExtensionWorker] Failed to cleanup DB after install failure for ${extensionKey}:`,
            cleanupErr,
          );
        }
      }

      // Send *_FAILED notification types so the frontend can show error toasts
      // instead of false success messages.
      const type =
        job.name === 'toggle'
          ? isActive
            ? 'EXTENSION_ACTIVATE_FAILED'
            : 'EXTENSION_DEACTIVATE_FAILED'
          : job.name === 'delete'
            ? 'EXTENSION_UNINSTALL_FAILED'
            : 'EXTENSION_INSTALL_FAILED';
      notifyExtensionChange(container, type, extensionKey);
    });
  }

  // Reconcile stale is_active flags on boot (async, non-blocking)
  reconcileExtensionStates(container, queueChannel);
}
