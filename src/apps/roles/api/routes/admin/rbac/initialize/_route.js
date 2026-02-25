import {
  DEFAULT_ACTIONS,
  DEFAULT_RESOURCES,
} from '../../../../../../users/api/constants/rbac';
import * as rbacController from '../../../../controllers/admin/rbac.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const post = [
  requirePermission(`${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`),
  rbacController.initializeDefaults,
];
