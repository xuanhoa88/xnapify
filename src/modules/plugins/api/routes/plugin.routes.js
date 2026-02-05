/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Router } from 'express';
import * as pluginController from '../controllers/plugin.controller';

/**
 * Plugin Routes
 *
 * Handles plugin API operations including listing plugins,
 * getting plugin metadata, and serving plugin static files.
 *
 * All routes are public.
 *
 * @param {Object} _app - Express application instance
 * @returns {Router} Express router with plugin routes
 */
export default function pluginRoutes(_app) {
  const router = Router();

  /**
   * @route   GET /plugins
   * @desc    List all available plugins
   * @access  Public
   */
  router.get('/', pluginController.listPlugins);

  /**
   * @route   GET /plugins/:id
   * @desc    Get plugin metadata and remote entry URL
   * @access  Public
   */
  router.get('/:id', pluginController.getPlugin);

  /**
   * @route   GET /plugins/:id/static/*
   * @desc    Serve plugin static files (plugin.js, chunks, assets)
   * @access  Public
   */
  router.use('/:id/static', pluginController.servePluginStatic);

  return router;
}
