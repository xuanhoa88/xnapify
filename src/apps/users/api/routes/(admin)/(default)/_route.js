import * as userController from '../../../controllers/admin/user.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const post = [
  requirePermission('users:create'),
  userController.createUser,
];

export const del = [
  requirePermission('users:delete'),
  userController.bulkDelete,
];

export { del as delete };
