/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Auto-discovered route: GET /api/admin/webhooks
 * File: (admin)/(default)/_route.js = /api/admin/webhooks
 *
 * Admin endpoint to list registered webhook providers.
 */

function requirePermission(permission) {
  return (req, res, next) => {
    const auth = req.app.get('container').resolve('auth');
    return auth.middlewares.requirePermission(permission)(req, res, next);
  };
}

/**
 * GET /api/webhooks — List all registered webhook providers
 */
async function list(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const webhook = container.resolve('webhook');

    const providers = webhook.getProviders();

    return http.sendSuccess(res, {
      data: {
        providers: providers.map(name => ({
          name,
          active: webhook.hasHandler(name),
        })),
        total: providers.length,
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to list webhooks', error);
  }
}

// GET /api/webhooks
export const get = [requirePermission('webhooks:read'), list];
