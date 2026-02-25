import * as profileController from '../../../../../users/api/controllers/profile.controller';

function authMiddleware(req, res, next) {
  const {
    middlewares: { requireAuth },
  } = req.app.get('auth');
  return requireAuth()(req, res, next);
}

export const get = [authMiddleware, profileController.previewAvatar];

export const post = [
  authMiddleware,
  (req, res, next) => {
    const fs = req.app.get('fs');
    const avatarUpload = fs.useUploadMiddleware({
      fieldName: 'avatar',
      maxFiles: 1,
      maxFileSize:
        parseInt(process.env.RSK_AVATAR_MAX_SIZE) || 10 * 1024 * 1024,
    });
    return avatarUpload(req, res, next);
  },
  profileController.uploadAvatar,
];

export const del = [authMiddleware, profileController.removeAvatar];

export { del as delete };
