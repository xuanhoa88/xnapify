import * as rbacController from '../../../../../../../roles/api/controllers/admin/rbac.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const post = [
  requirePermission('groups:update'),
  rbacController.addRoleToGroup,
];

export const del = [
  requirePermission('groups:update'),
  rbacController.removeRoleFromGroup,
];

export { del as delete };
