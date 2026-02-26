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
  function logout(req, res) {
    const container = req.app.get('container');
    const {
      controllers: { auth },
    } = container.resolve('users:controllers');
    return auth.logout(req, res);
  },
];
