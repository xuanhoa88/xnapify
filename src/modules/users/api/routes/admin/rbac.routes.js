/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_ACTIONS, DEFAULT_RESOURCES } from '../../constants/rbac';
import * as rbacController from '../../controllers/admin/rbac.controller';

/**
 * Role Management Routes
 *
 * Handles role CRUD operations, permission assignments, and RBAC system setup.
 *
 * All routes require authentication and specific permissions.
 *
 * @param {Object} app - Express application instance
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 * @returns {Router} Express router with role routes
 */
export default function rbacRoutes(app, { Router }) {
  const { requirePermission } = app.get('auth').middlewares;
  const router = Router();

  /**
   * @route   POST /initialize
   * @desc    Initialize roles, permissions and groups
   * @access  Admin (requires '*:*' permission - super admin)
   */
  router.post(
    '/initialize',
    requirePermission(`${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`),
    rbacController.initializeDefaults,
  );

  return router;
}
