/**
 * Auto-discovered route: GET /api/admin/settings, PUT /api/admin/settings
 * File: (admin)/(default)/_route.js = /api/admin/settings
 */

import * as controller from '../../../controllers/settings.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const auth = req.app.get('container').resolve('auth');
    return auth.middlewares.requirePermission(permission)(req, res, next);
  };
}

// GET /api/admin/settings
export const get = [requirePermission('settings:read'), controller.list];

// PUT /api/admin/settings
export const put = [requirePermission('settings:write'), controller.update];
