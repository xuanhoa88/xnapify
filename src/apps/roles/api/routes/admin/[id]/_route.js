import * as roleController from '../../../controllers/admin/role.controller';

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
  roleController.getRoleById,
];

export const put = [
  requirePermission('roles:update'),
  roleController.updateRole,
];

export const del = [
  requirePermission('roles:delete'),
  roleController.deleteRole,
];

export { del as delete };
