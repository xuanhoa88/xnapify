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

  try {
    const grouped = await settings.getAll();
    return http.sendSuccess(res, grouped);
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

  try {
    const { namespace } = req.params;
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
 * PUT /api/admin/settings — bulk update settings
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function update(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const settings = container.resolve('settings');

  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return http.sendBadRequest(
        res,
        'Request body must contain an "updates" array',
      );
    }

    const results = await settings.bulkUpdate(updates);
    return http.sendSuccess(res, results);
  } catch (error) {
    if (error.name === 'SettingNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to update settings', error);
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
