/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Preview Controller
 *
 * Handles file preview operations.
 */

import * as filesystemActions from '../actions';
import { MIDDLEWARE_RESULT } from '../utils/constants';

/**
 * Handle file preview
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 * @param {boolean} options.asMiddleware - If true, store result in req[PREVIEW] and call next()
 * @param {Function} next - Express next middleware function
 */
export async function previewFile(req, res, options = {}, next = null) {
  const config = {
    asMiddleware: false,
    ...options,
  };

  try {
    const { fileName } = req.query;

    if (!fileName) {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.PREVIEW] = {
          success: false,
          error: 'fileName parameter is required',
        };
        return next();
      }
      return res.status(400).json({
        success: false,
        error: 'fileName parameter is required',
      });
    }

    const result = await filesystemActions.previewFile(fileName);

    if (!result.success) {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.PREVIEW] = {
          success: false,
          error: 'File not found',
          fileName,
        };
        return next();
      }
      return res.status(404).json({
        success: false,
        error: 'File not found',
        fileName,
      });
    }

    // Middleware mode: store result and call next (without streaming)
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.PREVIEW] = result;
      return next();
    }

    // Set headers for preview
    if (result.data.headers) {
      Object.entries(result.data.headers).forEach(([key, value]) =>
        res.set(key, value),
      );
    }

    // Add cache headers for preview
    res.set({
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': `inline; filename="${result.data.metadata.name}"`,
    });

    // Stream the file for preview
    const stream = result.data.stream.stream || result.data.stream;
    stream.pipe(res);
  } catch (error) {
    console.error('Preview error:', error);
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.PREVIEW] = {
        success: false,
        error: 'Preview failed',
        details: error.message,
      };
      return next();
    }
    return res.status(500).json({
      success: false,
      error: 'Preview failed',
      details: error.message,
    });
  }
}
