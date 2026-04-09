/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Settings Controllers
 *
 * Business logic controllers for the settings API.
 * Accessed via req.app.get('container').resolve('settings').
 */

import { namespaceUpdateSchema } from '../../validator/index.js';


/**
 * GET /api/admin/settings — list all settings grouped by namespace (admin)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function list(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const settings = container.resolve('settings');
  const auth = container.resolve('auth');
  const hook = container.resolve('hook');

  try {
    // 1. Resolve permissions if not already populated
    if (
      req.user &&
      !req.user.permissions &&
      hook &&
      hook.has('auth.permissions')
    ) {
      await hook('auth.permissions').invoke('resolve', req);
    }

    const isAdmin =
      (req.user && req.user.roles && req.user.roles.includes('admin')) || false;
    const userPermissions = (req.user && req.user.permissions) || [];

    const grouped = await settings.getAll();
    const authorizedGrouped = {};

    // 2. Filter out namespaces without read permissions
    for (const [ns, items] of Object.entries(grouped)) {
      if (
        isAdmin ||
        auth.middlewares.hasPermission(
          userPermissions,
          `settings.${ns}:read`,
        ) ||
        auth.middlewares.hasPermission(userPermissions, `settings:*`) ||
        auth.middlewares.hasPermission(userPermissions, `*:*`)
      ) {
        authorizedGrouped[ns] = items;
      }
    }

    return http.sendSuccess(res, authorizedGrouped);
  } catch (error) {
    return http.sendServerError(res, 'Failed to fetch settings', error);
  }
}

/**
 * GET /api/admin/settings/:namespace — list settings for a namespace
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getByNamespace(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const settings = container.resolve('settings');
  const auth = container.resolve('auth');
  const hook = container.resolve('hook');

  try {
    const { namespace } = req.params;

    // 1. Check permissions immediately
    if (
      req.user &&
      !req.user.permissions &&
      hook &&
      hook.has('auth.permissions')
    ) {
      await hook('auth.permissions').invoke('resolve', req);
    }
    const isAdmin =
      (req.user && req.user.roles && req.user.roles.includes('admin')) || false;
    const userPermissions = (req.user && req.user.permissions) || [];

    const hasReadPerm =
      isAdmin ||
      auth.middlewares.hasPermission(
        userPermissions,
        `settings.${namespace}:read`,
      ) ||
      auth.middlewares.hasPermission(userPermissions, `settings:*`) ||
      auth.middlewares.hasPermission(userPermissions, `*:*`);

    if (!hasReadPerm) {
      if (!res.headersSent) {
        return http.sendForbidden(
          res,
          `Permission denied: settings.${namespace}:read`,
        );
      }
      return;
    }

    const items = await settings.getAll(namespace);
    return http.sendSuccess(res, items);
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to fetch settings namespace',
      error,
    );
  }
}



/**
 * GET /api/settings/public — public settings (no auth required)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getPublic(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const settings = container.resolve('settings');

  try {
    const publicSettings = await settings.getPublic();
    return http.sendSuccess(res, publicSettings);
  } catch (error) {
    return http.sendServerError(res, 'Failed to fetch public settings', error);
  }
}

/**
 * PUT /api/admin/settings/:namespace — update settings for a specific namespace using data form payload
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateByNamespace(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const settings = container.resolve('settings');
  const auth = container.resolve('auth');
  const hook = container.resolve('hook');

  try {
    const { namespace } = req.params;
    const { body } = req;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return http.sendBadRequest(
        res,
        'Request body must be a JSON object mapping keys to values',
      );
    }

    const parsedBody = namespaceUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return http.sendValidationError(res, parsedBody.error);
    }
    const cleanBody = parsedBody.data;

    if (
      req.user &&
      !req.user.permissions &&
      hook &&
      hook.has('auth.permissions')
    ) {
      await hook('auth.permissions').invoke('resolve', req);
    }
    const isAdmin =
      (req.user && req.user.roles && req.user.roles.includes('admin')) || false;
    const userPermissions = (req.user && req.user.permissions) || [];

    const hasWritePerm =
      isAdmin ||
      auth.middlewares.hasPermission(
        userPermissions,
        `settings.${namespace}:write`,
      ) ||
      auth.middlewares.hasPermission(userPermissions, `settings:*`) ||
      auth.middlewares.hasPermission(userPermissions, `*:*`);

    if (!hasWritePerm) {
      if (!res.headersSent) {
        return http.sendForbidden(
          res,
          `Permission denied: settings.${namespace}:write`,
        );
      }
      return;
    }

    // Convert data object to updates array format supported by settings bucket
    const updates = Object.entries(cleanBody).map(([key, value]) => ({
      namespace,
      key,
      value:
        value === null
          ? null
          : typeof value === 'boolean'
            ? value
              ? 'true'
              : 'false'
            : String(value),
    }));

    const results = await settings.bulkUpdate(updates);
    return http.sendSuccess(res, results);
  } catch (error) {
    if (error.name === 'SettingNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(
      res,
      'Failed to update settings namespace',
      error,
    );
  }
}
