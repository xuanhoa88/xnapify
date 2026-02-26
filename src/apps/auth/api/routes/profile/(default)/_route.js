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
    return profile.getProfile(req, res);
  },
];

export const put = [
  authMiddleware,
  function put(req, res) {
    const container = req.app.get('container');
    const {
      controllers: { profile },
    } = container.resolve('users:controllers');
    return profile.updateProfile(req, res);
  },
];
