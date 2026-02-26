/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacController from '../../../../controllers/admin/rbac.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('roles:read'),
  rbacController.getRolePermissions,
];

export const put = [
  requirePermission('roles:update'),
  rbacController.manageRolePermissions,
];
