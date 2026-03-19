/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacController from '../../../../controllers/admin/rbac.controller';

function requirePermission() {
  return (req, ...args) => {
    const {
      middlewares: { requirePermission },
      DEFAULT_RESOURCES,
      DEFAULT_ACTIONS,
    } = req.app.get('container').resolve('auth');

    return requirePermission(
      `${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`,
    )(req, ...args);
  };
}

export const post = [requirePermission(), rbacController.initializeDefaults];
