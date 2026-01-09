/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Info Controller
 *
 * Handles file information retrieval operations.
 */

import * as filesystemActions from '../actions';
import { MIDDLEWARE_RESULT } from '../utils/constants';

/**
 * Get file information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 * @param {boolean} options.asMiddleware - If true, store result in req[INFO] and call next()
 * @param {Function} next - Express next middleware function
 */
export async function getFileInfo(req, res, options = {}, next = null) {
  const config = {
    asMiddleware: false,
    ...options,
  };

  try {
    const { fileName } = req.query;

    if (!fileName) {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.INFO] = {
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

    const result = await filesystemActions.getFileInfo(fileName);

    if (!result.success) {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.INFO] = {
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

    // Middleware mode: store result and call next
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.INFO] = result;
      return next();
    }

    res.json(result);
  } catch (error) {
    console.error('File info retrieval error:', error);
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.INFO] = {
        success: false,
        error: 'File info retrieval failed',
        details: error.message,
      };
      return next();
    }
    return res.status(500).json({
      success: false,
      error: 'File info retrieval failed',
      details: error.message,
    });
  }
}
