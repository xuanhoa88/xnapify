/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Admin Route
 */

import * as controller from '../../../controllers/admin/activities.controller';

/**
 * Permission guard middleware
 * @param {string} permission - Permission name
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const get = [
  requirePermission('activities:read'),
  controller.listActivities,
];

export default get;
