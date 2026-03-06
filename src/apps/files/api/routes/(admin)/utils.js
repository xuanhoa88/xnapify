/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const requireAuth = (req, res, next) => {
  return req.app.get('auth').useRequireAuth()(req, res, next);
};

export const requirePermission = permission => (req, res, next) => {
  const auth = req.app.get('auth');
  return auth.middlewares.requirePermission(permission)(req, res, next);
};

export const middleware = [requireAuth];
