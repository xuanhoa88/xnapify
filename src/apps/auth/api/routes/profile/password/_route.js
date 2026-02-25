import * as profileController from '../../../../../users/api/controllers/profile.controller';

function authMiddleware(req, res, next) {
  const {
    middlewares: { requireAuth },
  } = req.app.get('auth');
  return requireAuth()(req, res, next);
}

export const put = [authMiddleware, profileController.changePassword];
