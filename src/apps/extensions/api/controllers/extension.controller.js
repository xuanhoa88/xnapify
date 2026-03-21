/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import express from 'express';

import { validateForm, z } from '@shared/validator';

import {
  extensionStatusSchema,
  extensionUpgradeSchema,
} from '../../validator/extension';
import * as extensionService from '../services/extension.service';

// ========================================================================
// EXTENSION CONTROLLERS
// ========================================================================

/**
 * List all available extensions
 *
 * @route   GET /api/extensions
 * @access  Public (Cached)
 */
export const listExtensions = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const extensions = await extensionService.getActiveExtensions({
      extensionManager: container.resolve('extension'),
      models: container.resolve('models'),
      cache: container.resolve('cache'),
      cwd: container.resolve('cwd'),
      actorId: req.user && req.user.id,
    });
    return http.sendSuccess(res, { extensions });
  } catch (err) {
    return http.sendServerError(res, 'Failed to list extensions', err);
  }
};

/**
 * Get extension details
 *
 * @route   GET /api/extensions/:id
 */
export const getExtension = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const extensionData = await extensionService.getExtensionById(
      {
        extensionManager: container.resolve('extension'),
        cwd: container.resolve('cwd'),
        models: container.resolve('models'),
        cache: container.resolve('cache'),
      },
      req.params.id,
    );

    // Broadcast tamper warning via WS so admin UI shows a flash message
    if (extensionData.manifest && extensionData.manifest.isTampered) {
      const ws = container.resolve('ws');
      if (ws) {
        ws.sendToPublicChannel('extension:updated', {
          type: 'EXTENSION_TAMPERED',
          extensionId: req.params.id,
        });
      }
    }

    return http.sendSuccess(res, extensionData);
  } catch (err) {
    if (err.status === 404) {
      return http.sendError(res, err.message, 404);
    }
    return http.sendServerError(res, 'Failed to get extension details', err);
  }
};

/**
 * Serve extension static files
 */
export const serveExtensionStatic = async (req, res, next) => {
  const container = req.app.get('container');
  const staticDir = await extensionService.getExtensionStaticDir(
    {
      extensionManager: container.resolve('extension'),
      cwd: container.resolve('cwd'),
      models: container.resolve('models'),
    },
    req.params.id,
  );
  if (!staticDir) {
    const http = container.resolve('http');
    return http.sendError(res, 'Invalid Extension ID', 400);
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
 * List all extensions (Admin) - Including inactive/missing
 *
 * @route   GET /api/admin/extensions
 * @access  Admin
 */
export const manageExtensions = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const extensions = await extensionService.manageExtensions({
      extensionManager: container.resolve('extension'),
      models: container.resolve('models'),
      cwd: container.resolve('cwd'),
      actorId: req.user && req.user.id,
      queue: container.resolve('queue'),
    });
    return http.sendSuccess(res, { extensions });
  } catch (err) {
    return http.sendServerError(res, 'Failed to manage extensions', err);
  }
};

// ========================================================================
// ADMIN CONTROLLERS
// ========================================================================

/**
 * Delete Extension (Admin)
 */
export const deleteExtension = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const models = container.resolve('models');

    await extensionService.deleteExtension(id, {
      models,
      cache: container.resolve('cache'),
      cwd: container.resolve('cwd'),
      actorId: req.user && req.user.id,
      queue: container.resolve('queue'),
    });

    const ws = container.resolve('ws');
    ws.sendToPublicChannel('extension:updated', {
      type: 'EXTENSION_UNINSTALLED',
      extensionId: id,
    });

    return http.sendSuccess(res, { message: 'Extension deleted' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to delete extension', error);
  }
};

// ========================================================================
// UPLOAD & STATUS CONTROLLERS
// ========================================================================

/**
 * Upload Extension (Admin)
 * Route: POST /api/admin/extensions/upload
 */
export const uploadExtension = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const fs = container.resolve('fs');
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

    const models = container.resolve('models');
    const extension = await extensionService.installExtensionFromPackage(file, {
      extensionManager: container.resolve('extension'),
      models,
      cache: container.resolve('cache'),
      cwd: container.resolve('cwd'),
      fs,
      actorId: req.user && req.user.id,
      queue: container.resolve('queue'),
    });

    // Convert to plain object and inject active job status for immediate frontend feedback
    const extensionData = {
      ...(typeof extension.toJSON === 'function'
        ? extension.toJSON()
        : extension),
      job_status: 'INSTALLING',
    };

    const ws = container.resolve('ws');
    ws.sendToPublicChannel('extension:updated', {
      type: 'EXTENSION_INSTALLED',
      extensionId: extensionData.id,
      data: { manifest: extensionData },
    });

    return http.sendSuccess(
      res,
      { extension: extensionData, message: 'Extension installed successfully' },
      201,
    );
  } catch (error) {
    return http.sendServerError(res, 'Failed to upload extension', error);
  }
};

/**
 * Update Extension Status (Admin)
 * Route: PATCH /api/admin/extensions/:id/status
 */
export const updateExtensionStatus = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const i18n = container.resolve('i18n');
    const schema = extensionStatusSchema({ i18n, z });
    const [isValid, result] = validateForm(() => schema, req.body);
    if (!isValid) return http.sendValidationError(res, result);

    const models = container.resolve('models');
    const extension = await extensionService.toggleExtensionStatus(
      id,
      result.is_active,
      {
        extensionManager: container.resolve('extension'),
        models,
        cache: container.resolve('cache'),
        cwd: container.resolve('cwd'),
        actorId: req.user && req.user.id,
        queue: container.resolve('queue'),
      },
    );

    // Convert to plain object (toggle is synchronous — no background job)
    const extensionData =
      typeof extension.toJSON === 'function' ? extension.toJSON() : extension;

    const ws = container.resolve('ws');
    ws.sendToPublicChannel('extension:updated', {
      type: result.is_active ? 'EXTENSION_ACTIVATED' : 'EXTENSION_DEACTIVATED',
      extensionId: id,
      data: { manifest: extensionData },
    });

    return http.sendSuccess(res, { extension: extensionData });
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to update extension status',
      error,
    );
  }
};

/**
 * Upgrade Extension (Admin)
 * Route: PATCH /api/admin/extensions/:id
 */
export const upgradeExtension = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { id } = req.params;
    const i18n = container.resolve('i18n');
    const schema = extensionUpgradeSchema({ i18n, z });
    const [isValid, result] = validateForm(() => schema, req.body);
    if (!isValid) return http.sendValidationError(res, result);

    const models = container.resolve('models');
    const extension = await extensionService.upgradeExtension(id, result, {
      models,
      cache: container.resolve('cache'),
      actorId: req.user && req.user.id,
    });

    const ws = container.resolve('ws');
    ws.sendToPublicChannel('extension:updated', {
      type: 'EXTENSION_UPDATED',
      extensionId: id,
    });

    return http.sendSuccess(res, { extension });
  } catch (error) {
    return http.sendServerError(res, 'Failed to upgrade extension', error);
  }
};

// ========================================================================
// IPC GATEWAY
// ========================================================================

/**
 * Handle Extension IPC
 *
 * Centralized gateway for extension inter-process communication.
 * Extensions register IPC handlers via registry.registerHook('ipc:<extensionId>:<action>', handler).
 * The gateway validates the request, executes the hook, and returns the result.
 *
 * @route   POST /api/extensions/:id/ipc
 * @body    { action: string, data?: any }
 */
export const handleIPC = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
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

    // Build the hook ID: ipc:<extensionId>:<action>
    const hookId = `ipc:${id}:${action}`;
    const { registry: extensionRegistry } = req.app
      .get('container')
      .resolve('extension');

    // Check if any handler is registered before executing
    if (!extensionRegistry.hasHook(hookId)) {
      return http.sendError(
        res,
        `No IPC handler registered for action "${action}" on extension "${id}"`,
        404,
      );
    }

    // Execute the IPC hook (in parallel for maximum throughput)
    const results = await extensionRegistry.executeHookParallel(hookId, data, {
      req,
      res,
    });

    // Return the first handler's result (single handler per action is expected)
    return http.sendSuccess(res, results[0] || null);
  } catch (error) {
    return http.sendServerError(res, 'Extension IPC failed', error);
  }
};
