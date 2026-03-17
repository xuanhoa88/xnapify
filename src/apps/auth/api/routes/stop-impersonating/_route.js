/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

function requireAuth() {
  return (req, res, next) => {
    const {
      middlewares: { requireAuth },
    } = req.app.get('auth');
    return requireAuth()(req, res, next);
  };
}

export const post = [
  requireAuth(),
  function stopImpersonating(req, ...args) {
    const { auth } = req.app.get('container').resolve('users:controllers');
    return auth.stopImpersonating(req, ...args);
  },
];
