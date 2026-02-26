/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

function authMiddleware(req, res, next) {
  const {
    middlewares: { requireAuth },
  } = req.app.get('auth');
  return requireAuth()(req, res, next);
}

export const get = [
  authMiddleware,
  function get(req, res) {
    const container = req.app.get('container');
    const {
      controllers: { profile },
    } = container.resolve('users:controllers');
    return profile.previewAvatar(req, res);
  },
];

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
  function uploadAvatar(req, res) {
    const container = req.app.get('container');
    const {
      controllers: { profile },
    } = container.resolve('users:controllers');
    return profile.uploadAvatar(req, res);
  },
];

export const del = [
  authMiddleware,
  function removeAvatar(req, res) {
    const container = req.app.get('container');
    const {
      controllers: { profile },
    } = container.resolve('users:controllers');
    return profile.removeAvatar(req, res);
  },
];

export { del as delete };
