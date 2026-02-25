import * as authController from '../../../../users/api/controllers/auth.controller';

function authMiddleware(req, res, next) {
  const {
    middlewares: { requireAuth },
  } = req.app.get('auth');
  return requireAuth()(req, res, next);
}

export const get = [authMiddleware, authController.logout];
