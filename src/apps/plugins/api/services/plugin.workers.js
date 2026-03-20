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
  installPluginDependencies,
  uninstallPluginDependencies,
  notifyPluginChange,
} from './plugin.helpers';

// ========================================================================
// Individual Worker Handlers
// ========================================================================

/**
 * Handle the "install" job for a plugin.
 *
 * @param {Object} container - DI container instance
 * @param {Object} job - Queue job
 */
async function handleInstallJob(container, job) {
  const { pluginDir, pluginId, pluginKey, actorId } = job.data;
  const pluginManager = container.resolve('plugin');
  const hook = container.resolve('hook');

  try {
    job.updateProgress(10);
    await installPluginDependencies(pluginDir, { name: pluginKey || pluginId });
    job.updateProgress(50);

    // Compute checksum in worker thread (avoids blocking event loop)
    const checksum = await workerPool.computeChecksum(pluginDir);
    const { Plugin } = container.resolve('models');
    await Plugin.update({ checksum }, { where: { id: pluginId } });
    job.updateProgress(60);

    if (pluginManager) {
      await pluginManager.reloadPlugin(pluginId);
      const metadata = pluginManager.getPluginMetadata(pluginId);
      if (
        metadata &&
        metadata.manifest &&
        !pluginManager.isPluginLoaded(pluginId)
      ) {
        await pluginManager.emit('plugin:loaded', { id: pluginId });
      }
    }
    job.updateProgress(90);

    if (hook) {
      hook('admin:plugins').emit('installed', {
        plugin_id: pluginId,
        actor_id: actorId,
        data: { path: pluginDir, checksum },
      });
    }

    notifyPluginChange(container, 'PLUGIN_INSTALLED', pluginId);
    job.updateProgress(100);
    return { success: true };
  } catch (err) {
    console.error(`[PluginWorker] Install failed for ${pluginId}:`, err);
    throw err;
  }
}

/**
 * Handle the "delete" job for a plugin.
 *
 * @param {Object} container - DI container instance
 * @param {Object} job - Queue job
 */
async function handleDeleteJob(container, job) {
  const { pluginId, pluginKey, actorId } = job.data;
  const cwd = container.resolve('cwd');
  const pluginManager = container.resolve('plugin');
  const hook = container.resolve('hook');
  const { Plugin } = container.resolve('models');

  try {
    if (pluginManager && pluginId) {
      if (pluginManager.isPluginLoaded(pluginId)) {
        await pluginManager.unloadPlugin(pluginId);
      } else {
        await pluginManager.emit('plugin:unloaded', { id: pluginId });
      }
    }

    // Remove files from both directories (with path traversal guard)
    if (cwd && pluginManager) {
      const dirs = [
        pluginManager.getPluginPath(),
        pluginManager.getDevPluginPath(cwd),
      ].filter(Boolean);
      for (const baseDir of dirs) {
        const pDir = path.join(baseDir, pluginKey);
        const relative = path.relative(baseDir, pDir);
        if (
          relative &&
          !relative.startsWith('..') &&
          !path.isAbsolute(relative)
        ) {
          if (fs.existsSync(pDir)) {
            await uninstallPluginDependencies(pDir, { name: pluginKey });
            await fs.promises.rm(pDir, { recursive: true, force: true });
          }
        }
      }
    }

    if (pluginId) {
      await Plugin.destroy({ where: { id: pluginId } });
    }
    if (hook) {
      hook('admin:plugins').emit('deleted', {
        plugin_id: pluginId || pluginKey,
        actor_id: actorId,
        data: { key: pluginKey },
      });
    }

    notifyPluginChange(container, 'PLUGIN_UNINSTALLED', pluginId || pluginKey);
    return { success: true };
  } catch (err) {
    console.error(
      `[PluginWorker] Delete failed for ${pluginId || pluginKey}:`,
      err,
    );
    throw err;
  }
}

/**
 * Handle the "toggle" job for a plugin.
 *
 * @param {Object} container - DI container instance
 * @param {Object} job - Queue job
 */
async function handleToggleJob(container, job) {
  const { pluginId, pluginKey, isActive, actorId, pluginDir, isDevPlugin } =
    job.data;
  const pluginManager = container.resolve('plugin');
  const hook = container.resolve('hook');

  try {
    // Security: verify checksum before activating (skip for dev plugins)
    if (isActive && pluginDir && !isDevPlugin) {
      const { Plugin } = container.resolve('models');
      const dbPlugin = await Plugin.findByPk(pluginId);
      if (dbPlugin && dbPlugin.checksum) {
        // Verify checksum in worker thread (avoids blocking event loop)
        const { valid, actual } = await workerPool.verifyChecksum(
          pluginDir,
          dbPlugin.checksum,
        );
        if (!valid) {
          console.error(
            `[PluginWorker] ⛔ Checksum verification FAILED for plugin ${pluginId}. ` +
              `Expected: ${dbPlugin.checksum}, Got: ${actual}. ` +
              `Refusing to activate — possible code injection detected.`,
          );
          await dbPlugin.update({ is_active: false });
          notifyPluginChange(container, 'PLUGIN_TAMPERED', pluginId);
          return { success: false, reason: 'checksum_mismatch' };
        }
      }
    }

    if (pluginDir) {
      if (isActive) {
        await installPluginDependencies(pluginDir, { name: pluginKey });

        // Recompute checksum in worker thread after fresh npm install
        const checksum = await workerPool.computeChecksum(pluginDir);
        const { Plugin } = container.resolve('models');
        await Plugin.update({ checksum }, { where: { id: pluginId } });
      } else {
        await uninstallPluginDependencies(pluginDir, { name: pluginKey });
      }
    }

    if (pluginManager) {
      if (isActive) {
        await pluginManager.reloadPlugin(pluginId);
        const metadata = pluginManager.getPluginMetadata(pluginId);
        if (
          metadata &&
          metadata.manifest &&
          !pluginManager.isPluginLoaded(pluginId)
        ) {
          await pluginManager.emit('plugin:loaded', { id: pluginId });
        }
      } else {
        if (pluginManager.isPluginLoaded(pluginId)) {
          await pluginManager.unloadPlugin(pluginId);
        } else {
          await pluginManager.emit('plugin:unloaded', { id: pluginId });
        }
      }
    }

    if (hook) {
      hook('admin:plugins').emit('status_changed', {
        plugin_id: pluginId,
        actor_id: actorId,
        data: { isActive },
      });
    }

    notifyPluginChange(
      container,
      isActive ? 'PLUGIN_UPDATED' : 'PLUGIN_UNINSTALLED',
      pluginId,
    );
    return { success: true };
  } catch (err) {
    console.error(`[PluginWorker] Toggle failed for ${pluginId}:`, err);
    throw err;
  }
}

// ========================================================================
// Registration
// ========================================================================

/**
 * Register background workers for plugin tasks.
 * Called during server initialization.
 *
 * @param {Object} container - DI container instance
 */
export function registerPluginWorkers(container) {
  const queue = container.resolve('queue');
  const queueChannel = queue('plugins');

  // Register event handlers for plugin tasks
  queueChannel.on('install', job => handleInstallJob(container, job));
  queueChannel.on('delete', job => handleDeleteJob(container, job));
  queueChannel.on('toggle', job => handleToggleJob(container, job));
}
