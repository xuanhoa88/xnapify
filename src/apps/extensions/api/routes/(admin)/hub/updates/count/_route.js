/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Permission guard middleware
 * @param {string} permission - Permission name
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

/**
 * Get available updates count
 * Route: GET /api/admin/extensions/hub/updates/count
 */
export const get = [
  requirePermission('extensions:read'),
  async (req, res) => {
    const container = req.app.get('container');
    const http = container.resolve('http');
    const cache = container.resolve('cache');

    try {
      const count = (await cache.get('extension_update_count')) || 0;
      return http.sendSuccess(res, { count });
    } catch (error) {
      return http.sendServerError(res, 'Failed to fetch update count', error);
    }
  },
];

export default get;
