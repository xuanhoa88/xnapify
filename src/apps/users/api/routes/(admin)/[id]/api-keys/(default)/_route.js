import * as userController from '../../../../../controllers/admin/user.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('apiKeys:read'),
  userController.listApiKeys,
];

export const post = [
  requirePermission('apiKeys:create'),
  userController.createApiKey,
];
