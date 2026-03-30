/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

function authMiddleware(req, res, next) {
  const {
    middlewares: { requireAuth },
  } = req.app.get('container').resolve('auth');
  return requireAuth()(req, res, next);
}

export const get = [
  authMiddleware,
  function getProfile(req, ...args) {
    const { profile } = req.app.get('container').resolve('users:controllers');
    return profile.getProfile(req, ...args);
  },
];

export const put = [
  authMiddleware,
  function updateProfile(req, ...args) {
    const { profile } = req.app.get('container').resolve('users:controllers');
    return profile.updateProfile(req, ...args);
  },
];
