/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import express from 'express';
import * as pluginService from '../services/plugin.service';

// ========================================================================
// PLUGIN CONTROLLERS
// ========================================================================

/**
 * List all available plugins
 *
 * @route   GET /api/plugins
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const listPlugins = async (req, res) => {
  try {
    const plugins = await pluginService.listAllPlugins(req.app);
    res.json({ success: true, data: { plugins } });
  } catch (err) {
    res.json({ success: false, data: { plugins: [] } });
  }
};

/**
 * Get plugin metadata and remote entry URL
 *
 * @route   GET /api/plugins/:id
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getPlugin = async (req, res) => {
  try {
    const pluginData = await pluginService.getPluginById(
      req.app,
      req.params.id,
    );
    res.json({ success: true, data: pluginData });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Serve plugin static files using express.static
 *
 * @route   GET /api/plugins/:id/static/*
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
export const servePluginStatic = (req, res, next) => {
  const root = pluginService.getPluginStaticDir(req.app, req.params.id);

  if (!root) {
    return res.status(400).send('Invalid Plugin ID');
  }

  // Use express.static to serve files from the plugin directory
  return express.static(root)(req, res, next);
};
