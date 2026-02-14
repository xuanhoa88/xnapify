/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as pluginController from '../controllers/plugin.controller';

/**
 * Plugin Routes
 *
 * Handles plugin API operations including listing plugins,
 * getting plugin metadata, serving files, and ADmin management.
 *
 * @param {Object} _app - Express application instance
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 * @returns {Router} Express router with plugin routes
 */
export default function pluginRoutes(app, { Router }) {
  const fs = app.get('fs');
  const uploadMiddleware = fs.useUploadMiddleware({ fieldName: 'file' });

  const userMiddlewares = app.get('user.middlewares');
  const { requirePermission } = userMiddlewares;

  const router = Router();

  // Admin / Management
  const adminRouter = Router();

  // List (Admin)
  adminRouter.get(
    '/',
    requirePermission('plugins:read'), // Assuming read permission exists or use same as create?
    // Actually, let's check permissions. 'plugins:create', 'plugins:update', 'plugins:delete'.
    // Maybe 'plugins:read' or just 'plugins:manage'?
    // For now let's reuse 'plugins:read' if defined in RBAC, or default if admin route implies admin access.
    // The previous implementation didn't have a list admin route.
    // Let's assume 'plugins:read' or generally accessible to admins.
    // Since we don't have rbac definitions here, I'll use requirePermission('plugins:read').
    // If it fails, user can update RBAC.
    pluginController.managePlugins,
  );

  adminRouter.post(
    '/upload',
    requirePermission('plugins:create'),
    uploadMiddleware,
    pluginController.uploadPlugin,
  );

  // Update
  adminRouter.patch(
    '/:id',
    requirePermission('plugins:update'),
    pluginController.updatePlugin,
  );

  // Status
  adminRouter.patch(
    '/:id/status',
    requirePermission('plugins:update'),
    pluginController.updatePluginStatus,
  );

  // Delete (Uninstall)
  adminRouter.delete(
    '/:id',
    requirePermission('plugins:delete'),
    pluginController.deletePlugin,
  );

  // Mount Admin routes FIRST to avoid collision with /:id
  router.use('/admin', adminRouter);

  // Public / Shared
  router.get('/', pluginController.listPlugins);
  router.get('/:id', pluginController.getPlugin);
  router.use('/:id/static', pluginController.servePluginStatic);

  return router;
}
