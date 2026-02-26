/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacController from '../../../../../../../roles/api/controllers/admin/rbac.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const post = [
  requirePermission('groups:update'),
  rbacController.addRoleToGroup,
];

export const del = [
  requirePermission('groups:update'),
  rbacController.removeRoleFromGroup,
];

export { del as delete };
