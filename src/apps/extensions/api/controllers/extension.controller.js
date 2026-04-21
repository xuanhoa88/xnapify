/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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

// Cache for static middleware
const staticMiddlewareCache = new Map();

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
          extensionId: extensionData.manifest.name || req.params.id,
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
 * Serve extension static files.
 * Content-hashed assets (e.g. 'remote.a1b2c3d4.js') get immutable caching
 * in production. In development, all assets use no-store to ensure the
 * browser always re-fetches after extension HMR rebuilds change content hashes.
 */
export const serveExtensionStatic = async (req, res) => {
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
  let { path: rawPath } = req.params || {};
  if (Array.isArray(rawPath)) {
    rawPath = rawPath.join('/');
  }
  const filePath = `/${rawPath}`.replace(/\/+/g, '/');
  req.url = filePath;

  // Content-hashed files are immutable — cache forever (production only).
  // In dev mode, extension HMR rebuilds change content hashes; immutable
  // caching would cause the browser to serve stale chunks from disk cache
  // after a rebuild, leading to MIME type errors (old URL → 404 → JSON).
  // Pattern: <name>.<8-char-hex>.<ext> (e.g. 'remote.a1b2c3d4.js')
  const isHashed = /\.[a-f0-9]{8}\.\w+$/.test(filePath);

  if (isHashed && !__DEV__) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // In development, skip the staticMiddlewareCache to avoid stale
  // express.static instances that may hold outdated filesystem state
  // after extension HMR rebuilds replace chunk files.
  let staticMiddleware;
  if (__DEV__) {
    staticMiddleware = express.static(staticDir);
  } else {
    staticMiddleware = staticMiddlewareCache.get(staticDir);
    if (!staticMiddleware) {
      staticMiddleware = express.static(staticDir);
      staticMiddlewareCache.set(staticDir, staticMiddleware);
    }
  }

  return staticMiddleware(req, res, () => {
    // Restore original URL before responding
    req.url = originalUrl;

    // Send a plain-text 404 instead of falling through to API JSON handlers.
    // Without this, the catch-all API middleware responds with application/json,
    // which triggers the browser's strict MIME type check for .js files.
    res.status(404).type('text/plain').send('Not Found');
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
      cache: container.resolve('cache'),
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
      extensionManager: container.resolve('extension'),
      cache: container.resolve('cache'),
      cwd: container.resolve('cwd'),
      actorId: req.user && req.user.id,
      queue: container.resolve('queue'),
    });

    // WS notification is handled by the worker's completed/failed events
    // to avoid premature success feedback before the background job finishes.

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

    // Convert to plain object and inject active job status for immediate frontend feedback.
    // Do NOT send a WS notification here — the worker's `completed` handler sends
    // EXTENSION_INSTALLED after npm install + integrity hash are actually done.
    const extensionData = {
      ...(typeof extension.toJSON === 'function'
        ? extension.toJSON()
        : extension),
      job_status: 'INSTALLING',
    };

    return http.sendSuccess(
      res,
      {
        extension: extensionData,
        message: 'Extension uploaded and queued for installation',
      },
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

    // Inject job_status so the frontend knows a background job was enqueued.
    // Without this, the Redux fulfilled handler would store the extension
    // without job_status, causing the reconciliation effect to prematurely
    // clear actionMap entries for OTHER extensions during the same render.
    const extensionData = {
      ...(typeof extension.toJSON === 'function'
        ? extension.toJSON()
        : extension),
      job_status: result.is_active ? 'ACTIVATING' : 'DEACTIVATING',
    };

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
      hook: container.resolve('hook'),
      actorId: req.user && req.user.id,
    });

    const ws = container.resolve('ws');
    ws.sendToPublicChannel('extension:updated', {
      type: 'EXTENSION_UPDATED',
      extensionId: extension.key || id,
    });

    return http.sendSuccess(res, { extension });
  } catch (error) {
    return http.sendServerError(res, 'Failed to upgrade extension', error);
  }
};

/**
 * Refresh Extensions (Admin)
 * Re-syncs the server-side extension manager — unloads all extensions,
 * re-fetches from the API, and re-loads them. Broadcasts to all clients
 * so they can hot-reload in place.
 *
 * @route   POST /api/admin/extensions/refresh
 * @access  Admin
 */
export const refreshExtensions = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    await extensionService.refreshExtensions([], {
      extensionManager: container.resolve('extension'),
      cache: container.resolve('cache'),
      models: container.resolve('models'),
    });

    const ws = container.resolve('ws');
    ws.sendToPublicChannel('extension:updated', {
      type: 'EXTENSIONS_REFRESHED',
    });

    return http.sendSuccess(res, { message: 'Extensions refreshed' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to refresh extensions', error);
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
