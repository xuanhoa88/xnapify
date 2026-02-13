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

  const userMiddlewares = app.get('user.middlewares');
  const { requirePermission } = userMiddlewares;

  const router = Router();

  // Public / Shared
  router.get('/', pluginController.listPlugins);
  router.get('/:id', pluginController.getPlugin);
  router.use('/:id/static', pluginController.servePluginStatic);

  // Admin / Management
  const adminRouter = Router();

  // Create (Upload)
  const uploadMiddleware = fs.useUploadMiddleware({ fieldName: 'file' });
  adminRouter.post(
    '/upload',
    requirePermission('plugins:create'),
    uploadMiddleware,
    pluginController.uploadPlugin,
  );

  // Create (Manual - Optional if keeping manual form)
  adminRouter.post(
    '/',
    requirePermission('plugins:create'),
    pluginController.createPlugin,
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

  // Mount Admin routes
  router.use('/admin', adminRouter);

  return router;
}
