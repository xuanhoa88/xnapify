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
  const { extensionDir, extensionKey, actorId } = job.data;

  try {
    const extensionManager = container.resolve('extension');
    const hook = container.resolve('hook');

    job.updateProgress(10);
    await installExtensionDependencies(extensionDir, {
      name: extensionKey,
    });
    job.updateProgress(50);

    // Compute checksum in worker thread (avoids blocking event loop)
    const checksum = await workerPool.computeChecksum(extensionDir);
    const { Extension } = container.resolve('models');
    await Extension.update({ checksum }, { where: { key: extensionKey } });
    job.updateProgress(60);

    if (extensionManager) {
      await extensionManager.reloadExtension(extensionKey);
      const metadata = extensionManager.getExtensionMetadata(extensionKey);
      if (
        metadata &&
        metadata.manifest &&
        !extensionManager.isExtensionLoaded(extensionKey)
      ) {
        await extensionManager.emit('extension:loaded', { id: extensionKey });
      }
    }
    job.updateProgress(90);

    if (hook) {
      hook('admin:extensions').emit('installed', {
        extension_id: extensionKey,
        actor_id: actorId,
        data: { path: extensionDir, checksum },
      });
    }

    notifyExtensionChange(container, 'EXTENSION_INSTALLED', extensionKey);
    job.updateProgress(100);
    return { success: true };
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
      if (extensionManager.isExtensionLoaded(extensionKey)) {
        await extensionManager.unloadExtension(extensionKey);
      } else {
        await extensionManager.emit('extension:unloaded', {
          id: extensionKey,
        });
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

    notifyExtensionChange(container, 'EXTENSION_UNINSTALLED', extensionKey);
    return { success: true };
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
    const { Extension } = container.resolve('models');

    // Security: verify checksum before activating (skip for dev extensions)
    if (isActive && extensionDir && !isDevExtension) {
      const dbExtension = await Extension.findOne({
        where: { key: extensionKey },
      });
      if (dbExtension && dbExtension.checksum) {
        // Verify checksum in worker thread (avoids blocking event loop)
        const { valid, actual } = await workerPool.verifyChecksum(
          extensionDir,
          dbExtension.checksum,
        );
        if (!valid) {
          console.error(
            `[ExtensionWorker] ⛔ Checksum verification FAILED for extension ${extensionKey}. ` +
              `Expected: ${dbExtension.checksum}, Got: ${actual}. ` +
              `Refusing to activate — possible code injection detected.`,
          );
          await dbExtension.update({ is_active: false });
          notifyExtensionChange(container, 'EXTENSION_TAMPERED', extensionKey);
          return { success: false, reason: 'checksum_mismatch' };
        }
      }
    }

    if (extensionDir && isActive) {
      await installExtensionDependencies(extensionDir, { name: extensionKey });

      // Recompute checksum in worker thread after fresh npm install
      const checksum = await workerPool.computeChecksum(extensionDir);
      await Extension.update({ checksum }, { where: { key: extensionKey } });
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

    notifyExtensionChange(
      container,
      isActive ? 'EXTENSION_ACTIVATED' : 'EXTENSION_DEACTIVATED',
      extensionKey,
    );
    return { success: true };
  } catch (err) {
    console.error(`[ExtensionWorker] Toggle failed for ${extensionKey}:`, err);
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
