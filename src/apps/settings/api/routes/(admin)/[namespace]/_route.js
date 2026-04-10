/**
 * Auto-discovered route: GET /api/admin/settings/:namespace
 * File: (admin)/[namespace]/_route.js = /api/admin/settings/:namespace
 *
 * Auth-only middleware — granular namespace-level RBAC (settings.{ns}:read/write)
 * is enforced inside the controller to support per-namespace permissions.
 */

import * as controller from '../../../controllers/settings.controller';

function requireAuth() {
  return (req, res, next) => {
    const auth = req.app.get('container').resolve('auth');
    return auth.middlewares.requireAuth()(req, res, next);
  };
}

// GET /api/admin/settings/:namespace
export const get = [requireAuth(), controller.getByNamespace];

// PUT /api/admin/settings/:namespace
export const put = [requireAuth(), controller.updateByNamespace];
