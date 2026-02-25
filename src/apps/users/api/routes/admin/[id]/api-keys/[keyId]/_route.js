import * as userController from '../../../../../controllers/admin/user.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const del = [
  requirePermission('apiKeys:delete'),
  userController.revokeApiKey,
];

export { del as delete };
