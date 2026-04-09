/**
 * Auto-discovered route: GET /api/admin/settings/:namespace
 * File: (admin)/[namespace]/_route.js = /api/admin/settings/:namespace
 */

import * as controller from '../../../controllers/settings.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const auth = req.app.get('container').resolve('auth');
    return auth.middlewares.requirePermission(permission)(req, res, next);
  };
}

function requireAuth() {
  return (req, res, next) => {
    const auth = req.app.get('container').resolve('auth');
    return auth.middlewares.requireAuth()(req, res, next);
  };
}

// GET /api/admin/settings/:namespace
export const get = [
  requirePermission('settings:read'),
  controller.getByNamespace,
];

// PUT /api/admin/settings/:namespace
export const put = [
  requirePermission('settings:write'),
  controller.updateByNamespace,
];
