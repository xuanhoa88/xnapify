import * as permissionController from '../../../controllers/admin/permission.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('permissions:read'),
  permissionController.getPermissions,
];

export const post = [
  requirePermission('permissions:create'),
  permissionController.createPermission,
];

export const del = [
  requirePermission('permissions:delete'),
  permissionController.deletePermissions,
];

export { del as delete };
