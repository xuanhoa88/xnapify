/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import express from 'express';
import { validateForm, z } from '@shared/validator';
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
      pluginManager: req.app.get('plugin'),
      models: req.app.get('models'),
      cache: req.app.get('cache'),
      cwd: req.app.get('cwd'),
      webhook: req.app.get('webhook'),
      actorId: req.user && req.user.id,
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
        pluginManager: req.app.get('plugin'),
        cwd: req.app.get('cwd'),
        models: req.app.get('models'),
        cache: req.app.get('cache'),
      },
      req.params.id,
    );

    // Broadcast tamper warning via WS so admin UI shows a flash message
    if (pluginData.manifest && pluginData.manifest.isTampered) {
      const ws = req.app.get('ws');
      if (ws) {
        ws.sendToPublicChannel('plugin:updated', {
          type: 'PLUGIN_TAMPERED',
          pluginId: req.params.id,
        });
      }
    }

    return http.sendSuccess(res, pluginData);
  } catch (err) {
    return http.sendServerError(res, 'Failed to get plugin details', err);
  }
};

/**
 * Serve plugin static files
 */
export const servePluginStatic = async (req, res, next) => {
  const staticDir = await pluginService.getPluginStaticDir(
    {
      pluginManager: req.app.get('plugin'),
      cwd: req.app.get('cwd'),
      models: req.app.get('models'),
    },
    req.params.id,
  );
  if (!staticDir) {
    const http = req.app.get('http');
    return http.sendError(res, 'Invalid Plugin ID', 400);
  }

  // Use the catch-all :path* param from [id]/static/[...path]/_route.js
  const originalUrl = req.url;
  req.url = `/${req.params.path}`.replace(/\/+/g, '/');

  return express.static(staticDir)(req, res, (...args) => {
    req.url = originalUrl;
    next(...args);
  });
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
      pluginManager: req.app.get('plugin'),
      models: req.app.get('models'),
      cwd: req.app.get('cwd'),
      webhook: req.app.get('webhook'),
      actorId: req.user && req.user.id,
      queue: req.app.get('queue'),
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
      actorId: req.user && req.user.id,
      queue: req.app.get('queue'),
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
      pluginManager: req.app.get('plugin'),
      models,
      cache: req.app.get('cache'),
      cwd: req.app.get('cwd'),
      fs,
      actorId: req.user && req.user.id,
      queue: req.app.get('queue'),
    });

    // Convert to plain object and inject active job status for immediate frontend feedback
    const pluginData = {
      ...(typeof plugin.toJSON === 'function' ? plugin.toJSON() : plugin),
      job_status: 'ACTIVE',
    };

    const ws = req.app.get('ws');
    ws.sendToPublicChannel('plugin:updated', {
      type: 'PLUGIN_INSTALLED',
      pluginId: pluginData.id,
      data: { manifest: pluginData },
    });

    return http.sendSuccess(
      res,
      { plugin: pluginData, message: 'Plugin installed successfully' },
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
        pluginManager: req.app.get('plugin'),
        models,
        cache: req.app.get('cache'),
        cwd: req.app.get('cwd'),
        actorId: req.user && req.user.id,
        queue: req.app.get('queue'),
      },
    );

    // Convert to plain object and inject active job status for immediate frontend feedback
    const pluginData = {
      ...(typeof plugin.toJSON === 'function' ? plugin.toJSON() : plugin),
      job_status: 'ACTIVE',
    };

    const ws = req.app.get('ws');
    ws.sendToPublicChannel('plugin:updated', {
      type: result.is_active ? 'PLUGIN_INSTALLED' : 'PLUGIN_UNINSTALLED',
      pluginId: id,
      data: { manifest: pluginData },
    });

    return http.sendSuccess(res, { plugin: pluginData });
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
      actorId: req.user && req.user.id,
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

// ========================================================================
// IPC GATEWAY
// ========================================================================

/**
 * Handle Plugin IPC
 *
 * Centralized gateway for plugin inter-process communication.
 * Plugins register IPC handlers via registry.registerHook('ipc:<pluginId>:<action>', handler).
 * The gateway validates the request, executes the hook, and returns the result.
 *
 * @route   POST /api/plugins/:id/ipc
 * @body    { action: string, data?: any }
 */
export const handleIPC = async (req, res) => {
  const http = req.app.get('http');
  try {
    const { id } = req.params;
    const { action, data } = req.body || {};

    // Validate action
    if (!action || typeof action !== 'string') {
      return http.sendError(
        res,
        'Missing or invalid "action" in request body',
        400,
      );
    }

    // Build the hook ID: ipc:<pluginId>:<action>
    const hookId = `ipc:${id}:${action}`;
    const pluginRegistry = req.app.get('plugin').registry;

    // Check if any handler is registered before executing
    if (!pluginRegistry.hasHook(hookId)) {
      return http.sendError(
        res,
        `No IPC handler registered for action "${action}" on plugin "${id}"`,
        404,
      );
    }

    // Execute the IPC hook (in parallel for maximum throughput)
    const results = await pluginRegistry.executeHookParallel(hookId, data, {
      req,
      res,
    });

    // Return the first handler's result (single handler per action is expected)
    return http.sendSuccess(res, results[0] || null);
  } catch (error) {
    return http.sendServerError(res, 'Plugin IPC failed', error);
  }
};
