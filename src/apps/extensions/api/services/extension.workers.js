/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
  const { extensionDir, extensionId, extensionKey, actorId } = job.data;
  const extensionManager = container.resolve('extension');
  const hook = container.resolve('hook');

  try {
    job.updateProgress(10);
    await installExtensionDependencies(extensionDir, {
      name: extensionKey || extensionId,
    });
    job.updateProgress(50);

    // Compute checksum in worker thread (avoids blocking event loop)
    const checksum = await workerPool.computeChecksum(extensionDir);
    const { Extension } = container.resolve('models');
    await Extension.update({ checksum }, { where: { id: extensionId } });
    job.updateProgress(60);

    if (extensionManager) {
      await extensionManager.reloadExtension(extensionId);
      const metadata = extensionManager.getExtensionMetadata(extensionId);
      if (
        metadata &&
        metadata.manifest &&
        !extensionManager.isExtensionLoaded(extensionId)
      ) {
        await extensionManager.emit('extension:loaded', { id: extensionId });
      }
    }
    job.updateProgress(90);

    if (hook) {
      hook('admin:extensions').emit('installed', {
        extension_id: extensionId,
        actor_id: actorId,
        data: { path: extensionDir, checksum },
      });
    }

    notifyExtensionChange(container, 'EXTENSION_INSTALLED', extensionId);
    job.updateProgress(100);
    return { success: true };
  } catch (err) {
    console.error(`[ExtensionWorker] Install failed for ${extensionId}:`, err);
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
  const { extensionId, extensionKey, actorId } = job.data;
  const cwd = container.resolve('cwd');
  const extensionManager = container.resolve('extension');
  const hook = container.resolve('hook');
  const { Extension } = container.resolve('models');

  try {
    if (extensionManager && extensionId) {
      if (extensionManager.isExtensionLoaded(extensionId)) {
        await extensionManager.unloadExtension(extensionId);
      } else {
        await extensionManager.emit('extension:unloaded', { id: extensionId });
      }
    }

    // Remove files from both directories (with path traversal guard)
    if (cwd && extensionManager) {
      const dirs = [
        extensionManager.getInstalledExtensionsDir(),
        extensionManager.getDevExtensionPath(cwd),
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
            if (fs.existsSync(pDir)) {
              await fs.promises.rm(pDir, { recursive: true, force: true });
            }
          }
        } catch {
          // Non-fatal — directory will be removed next
        }
      }
    }

    if (extensionId) {
      await Extension.destroy({ where: { id: extensionId } });
    }
    if (hook) {
      hook('admin:extensions').emit('deleted', {
        extension_id: extensionId || extensionKey,
        actor_id: actorId,
        data: { key: extensionKey },
      });
    }

    notifyExtensionChange(
      container,
      'EXTENSION_UNINSTALLED',
      extensionId || extensionKey,
    );
    return { success: true };
  } catch (err) {
    console.error(
      `[ExtensionWorker] Delete failed for ${extensionId || extensionKey}:`,
      err,
    );
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
  const {
    extensionId,
    extensionKey,
    isActive,
    actorId,
    extensionDir,
    isDevExtension,
  } = job.data;
  const extensionManager = container.resolve('extension');
  const hook = container.resolve('hook');

  try {
    // Security: verify checksum before activating (skip for dev extensions)
    if (isActive && extensionDir && !isDevExtension) {
      const { Extension } = container.resolve('models');
      const dbExtension = await Extension.findByPk(extensionId);
      if (dbExtension && dbExtension.checksum) {
        // Verify checksum in worker thread (avoids blocking event loop)
        const { valid, actual } = await workerPool.verifyChecksum(
          extensionDir,
          dbExtension.checksum,
        );
        if (!valid) {
          console.error(
            `[ExtensionWorker] ⛔ Checksum verification FAILED for extension ${extensionId}. ` +
              `Expected: ${dbExtension.checksum}, Got: ${actual}. ` +
              `Refusing to activate — possible code injection detected.`,
          );
          await dbExtension.update({ is_active: false });
          notifyExtensionChange(container, 'EXTENSION_TAMPERED', extensionId);
          return { success: false, reason: 'checksum_mismatch' };
        }
      }
    }

    if (extensionDir && isActive) {
      await installExtensionDependencies(extensionDir, { name: extensionKey });

      // Recompute checksum in worker thread after fresh npm install
      const checksum = await workerPool.computeChecksum(extensionDir);
      const { Extension } = container.resolve('models');
      await Extension.update({ checksum }, { where: { id: extensionId } });
    }

    if (extensionManager) {
      if (isActive) {
        await extensionManager.reloadExtension(extensionId);
        const metadata = extensionManager.getExtensionMetadata(extensionId);
        if (
          metadata &&
          metadata.manifest &&
          !extensionManager.isExtensionLoaded(extensionId)
        ) {
          await extensionManager.emit('extension:loaded', { id: extensionId });
        }
      } else {
        if (extensionManager.isExtensionLoaded(extensionId)) {
          await extensionManager.unloadExtension(extensionId);
        } else {
          await extensionManager.emit('extension:unloaded', {
            id: extensionId,
          });
        }
      }
    }

    if (hook) {
      hook('admin:extensions').emit('status_changed', {
        extension_id: extensionId,
        actor_id: actorId,
        data: { isActive },
      });
    }

    notifyExtensionChange(
      container,
      isActive ? 'EXTENSION_UPDATED' : 'EXTENSION_UNINSTALLED',
      extensionId,
    );
    return { success: true };
  } catch (err) {
    console.error(`[ExtensionWorker] Toggle failed for ${extensionId}:`, err);
    throw err;
  }
}

// ========================================================================
// Registration
// ========================================================================

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
}
