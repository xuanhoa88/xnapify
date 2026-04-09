/**
 * Auto-discovered route: GET /api/admin/settings, PUT /api/admin/settings
 * File: (admin)/(default)/_route.js = /api/admin/settings
 */

import * as controller from '../../../controllers/settings.controller';

function requireAuth() {
  return (req, res, next) => {
    const auth = req.app.get('container').resolve('auth');
    return auth.middlewares.requireAuth()(req, res, next);
  };
}

// GET /api/admin/settings
export const get = [requireAuth(), controller.list];


