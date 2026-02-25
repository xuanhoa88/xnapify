import * as rbacController from '../../../../../../../roles/api/controllers/admin/rbac.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('users:read'),
  rbacController.getUserPermissions,
];
