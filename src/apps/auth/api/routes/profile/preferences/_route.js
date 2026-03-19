/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
  function get(req, ...args) {
    const { profile } = req.app.get('container').resolve('users:controllers');
    return profile.getPreferences(req, ...args);
  },
];

export const put = [
  authMiddleware,
  function put(req, ...args) {
    const { profile } = req.app.get('container').resolve('users:controllers');
    return profile.updatePreferences(req, ...args);
  },
];
