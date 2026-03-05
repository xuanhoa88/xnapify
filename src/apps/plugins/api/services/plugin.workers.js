/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs';
import {
  getPluginPath,
  getDevPluginPath,
  resolvePluginsDir,
  installPluginDependencies,
  uninstallPluginDependencies,
  notifyPluginChange,
} from './plugin.helpers';
import { computeChecksum, verifyPluginChecksum } from '../utils/checksum';
import { logPluginActivity } from '../utils/activity';

// ========================================================================
// Individual Worker Handlers
// ========================================================================

/**
 * Handle the "install" job for a plugin.
 *
 * @param {Object} app - Express app instance
 * @param {Object} job - Queue job
 */
async function handleInstallJob(app, job) {
  const { pluginDir, pluginId, pluginKey, actorId } = job.data;
  const pluginManager = app.get('plugin');
  const webhook = app.get('webhook');

  try {
    job.updateProgress(10);
    await installPluginDependencies(pluginDir, { name: pluginKey || pluginId });
    job.updateProgress(50);

    // Compute and store checksum after clean install
    const checksum = await computeChecksum(pluginDir);
    const { Plugin } = app.get('models');
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

    await logPluginActivity(
      webhook,
      'installed',
      pluginId,
      { path: pluginDir, checksum },
      actorId,
    );

    notifyPluginChange(app, 'PLUGIN_INSTALLED', pluginId);
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
 * @param {Object} app - Express app instance
 * @param {Object} job - Queue job
 */
async function handleDeleteJob(app, job) {
  const { pluginId, pluginKey, actorId } = job.data;
  const cwd = app.get('cwd');
  const pluginManager = app.get('plugin');
  const webhook = app.get('webhook');
  const { Plugin } = app.get('models');

  try {
    if (pluginManager) {
      if (pluginManager.isPluginLoaded(pluginId)) {
        await pluginManager.unloadPlugin(pluginId);
      } else {
        await pluginManager.emit('plugin:unloaded', { id: pluginId });
      }
    }

    // Remove files from both directories (with path traversal guard)
    if (cwd) {
      const dirs = [
        resolvePluginsDir(cwd, getPluginPath()),
        resolvePluginsDir(cwd, getDevPluginPath()),
      ];
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

    await Plugin.destroy({ where: { id: pluginId } });
    await logPluginActivity(
      webhook,
      'deleted',
      pluginId,
      { key: pluginKey },
      actorId,
    );

    notifyPluginChange(app, 'PLUGIN_UNINSTALLED', pluginId);
    return { success: true };
  } catch (err) {
    console.error(`[PluginWorker] Delete failed for ${pluginId}:`, err);
    throw err;
  }
}

/**
 * Handle the "toggle" job for a plugin.
 *
 * @param {Object} app - Express app instance
 * @param {Object} job - Queue job
 */
async function handleToggleJob(app, job) {
  const { pluginId, pluginKey, isActive, actorId, pluginDir, isDevPlugin } =
    job.data;
  const pluginManager = app.get('plugin');
  const webhook = app.get('webhook');

  try {
    // Security: verify checksum before activating (skip for dev plugins)
    if (isActive && pluginDir && !isDevPlugin) {
      const { Plugin } = app.get('models');
      const dbPlugin = await Plugin.findByPk(pluginId);
      if (dbPlugin && dbPlugin.checksum) {
        const { valid, actual } = await verifyPluginChecksum(
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
          notifyPluginChange(app, 'PLUGIN_TAMPERED', pluginId);
          return { success: false, reason: 'checksum_mismatch' };
        }
      }
    }

    if (pluginDir) {
      if (isActive) {
        await installPluginDependencies(pluginDir, { name: pluginKey });

        // Recompute and store checksum after fresh npm install
        const checksum = await computeChecksum(pluginDir);
        const { Plugin } = app.get('models');
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

    await logPluginActivity(
      webhook,
      'status_changed',
      pluginId,
      { isActive },
      actorId,
    );

    notifyPluginChange(
      app,
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
 * @param {Object} app - Express app instance
 */
export function registerPluginWorkers(app) {
  const queue = app.get('queue');
  const queueChannel = queue('plugins');

  // Register event handlers for plugin tasks
  queueChannel.on('install', job => handleInstallJob(app, job));
  queueChannel.on('delete', job => handleDeleteJob(app, job));
  queueChannel.on('toggle', job => handleToggleJob(app, job));
}
