/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('groups:read'),
  (req, res) => {
    const rbacController = req.app
      .get('container')
      .resolve('roles:rbacController');
    return rbacController.getGroupRoles(req, res);
  },
];

export const put = [
  requirePermission('groups:update'),
  (req, res) => {
    const rbacController = req.app
      .get('container')
      .resolve('roles:rbacController');
    return rbacController.assignRolesToGroup(req, res);
  },
];
