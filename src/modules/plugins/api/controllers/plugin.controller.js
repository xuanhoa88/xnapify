/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import express from 'express';
import { validateForm, z } from '../../../../shared/validator';
import {
  pluginStatusSchema,
  pluginUpgradeSchema,
} from '../../validator/plugin';
import * as pluginService from '../services/plugin.service';

// ========================================================================
// PLUGIN CONTROLLERS
// ========================================================================

/**
 * List all available plugins
 *
 * @route   GET /api/plugins
 * @access  Public (Cached)
 */
export const listPlugins = async (req, res) => {
  const http = req.app.get('http');
  try {
    const plugins = await pluginService.getActivePlugins({
      models: req.app.get('models'),
      cache: req.app.get('cache'),
      cwd: req.app.get('cwd'),
      webhook: req.app.get('webhook'),
      actorId: req.user ? req.user.id : null,
    });
    return http.sendSuccess(res, { plugins });
  } catch (err) {
    return http.sendServerError(res, 'Failed to list plugins', err);
  }
};

/**
 * Get plugin details
 *
 * @route   GET /api/plugins/:id
 */
export const getPlugin = async (req, res) => {
  const http = req.app.get('http');
  try {
    const pluginData = await pluginService.getPluginById(
      {
        cwd: req.app.get('cwd'),
        models: req.app.get('models'),
        cache: req.app.get('cache'),
      },
      req.params.id,
    );
    return http.sendSuccess(res, pluginData);
  } catch (err) {
    return http.sendServerError(res, 'Failed to get plugin details', err);
  }
};

/**
 * Serve plugin static files
 */
export const servePluginStatic = async (req, res, next) => {
  const root = await pluginService.getPluginStaticDir(
    { cwd: req.app.get('cwd'), models: req.app.get('models') },
    req.params.id,
  );
  if (!root) {
    const http = req.app.get('http');
    return http.sendError(res, 'Invalid Plugin ID', 400);
  }
  return express.static(root)(req, res, next);
};

/**
 * List all plugins (Admin) - Including inactive/missing
 *
 * @route   GET /api/admin/plugins
 * @access  Admin
 */
export const managePlugins = async (req, res) => {
  const http = req.app.get('http');
  try {
    const plugins = await pluginService.managePlugins({
      models: req.app.get('models'),
      cwd: req.app.get('cwd'),
      webhook: req.app.get('webhook'),
      actorId: req.user ? req.user.id : null,
    });
    return http.sendSuccess(res, { plugins });
  } catch (err) {
    return http.sendServerError(res, 'Failed to manage plugins', err);
  }
};

// ========================================================================
// ADMIN CONTROLLERS
// ========================================================================

/**
 * Delete Plugin (Admin)
 */
export const deletePlugin = async (req, res) => {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const models = req.app.get('models');

    await pluginService.deletePlugin(id, {
      models,
      cache: req.app.get('cache'),
      cwd: req.app.get('cwd'),
      pluginManager: req.app.get('plugin'),
      webhook: req.app.get('webhook'),
      actorId: req.user ? req.user.id : null,
    });

    const ws = req.app.get('ws');
    ws.sendToPublicChannel('plugin:updated', {
      type: 'PLUGIN_UNINSTALLED',
      pluginId: id,
    });

    return http.sendSuccess(res, { message: 'Plugin deleted' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete plugin', error);
  }
};

// ========================================================================
// UPLOAD & STATUS CONTROLLERS
// ========================================================================

/**
 * Upload Plugin (Admin)
 * Route: POST /api/admin/plugins/upload
 */
export const uploadPlugin = async (req, res) => {
  const http = req.app.get('http');
  try {
    const fs = req.app.get('fs');
    const uploadResult = req[fs.MIDDLEWARES.UPLOAD];

    if (!uploadResult || !uploadResult.success) {
      const errorMsg =
        (uploadResult && uploadResult.error) || 'No file uploaded';
      return http.sendValidationError(res, { file: errorMsg });
    }

    const file = uploadResult.data;
    if (!file) {
      return http.sendValidationError(res, { file: 'File data missing' });
    }

    const models = req.app.get('models');
    const plugin = await pluginService.installPluginFromPackage(file, {
      models,
      cache: req.app.get('cache'),
      cwd: req.app.get('cwd'),
      fs,
      pluginManager: req.app.get('plugin'),
      webhook: req.app.get('webhook'),
      actorId: req.user ? req.user.id : null,
    });

    const ws = req.app.get('ws');
    ws.sendToPublicChannel('plugin:updated', {
      type: 'PLUGIN_INSTALLED',
      pluginId: plugin.id,
      data: { manifest: plugin },
    });

    return http.sendSuccess(
      res,
      { plugin, message: 'Plugin installed successfully' },
      201,
    );
  } catch (error) {
    return http.sendServerError(res, 'Failed to upload plugin', error);
  }
};

/**
 * Update Plugin Status (Admin)
 * Route: PATCH /api/admin/plugins/:id/status
 */
export const updatePluginStatus = async (req, res) => {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const i18n = req.app.get('i18n');
    const schema = pluginStatusSchema({ i18n, z });
    const [isValid, result] = validateForm(() => schema, req.body);
    if (!isValid) return http.sendValidationError(res, result);

    const models = req.app.get('models');
    const plugin = await pluginService.togglePluginStatus(
      id,
      result.is_active,
      {
        models,
        cache: req.app.get('cache'),
        cwd: req.app.get('cwd'),
        pluginManager: req.app.get('plugin'),
        webhook: req.app.get('webhook'),
        actorId: req.user ? req.user.id : null,
      },
    );

    const ws = req.app.get('ws');
    ws.sendToPublicChannel('plugin:updated', {
      type: result.is_active ? 'PLUGIN_INSTALLED' : 'PLUGIN_UNINSTALLED',
      pluginId: id,
      data: { manifest: plugin },
    });

    return http.sendSuccess(res, { plugin });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update plugin status', error);
  }
};

/**
 * Upgrade Plugin (Admin)
 * Route: PATCH /api/admin/plugins/:id
 */
export const upgradePlugin = async (req, res) => {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const i18n = req.app.get('i18n');
    const schema = pluginUpgradeSchema({ i18n, z });
    const [isValid, result] = validateForm(() => schema, req.body);
    if (!isValid) return http.sendValidationError(res, result);

    const models = req.app.get('models');
    const plugin = await pluginService.upgradePlugin(id, result, {
      models,
      cache: req.app.get('cache'),
      webhook: req.app.get('webhook'),
      actorId: req.user ? req.user.id : null,
    });

    const ws = req.app.get('ws');
    ws.sendToPublicChannel('plugin:updated', {
      type: 'PLUGIN_UPDATED',
      pluginId: id,
    });

    return http.sendSuccess(res, { plugin });
  } catch (error) {
    return http.sendServerError(res, 'Failed to upgrade plugin', error);
  }
};
