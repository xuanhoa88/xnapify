import * as roleController from '../../../../controllers/admin/role.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('roles:read'),
  roleController.getRoleUsers,
];
