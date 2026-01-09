/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Sync Controller
 *
 * Handles cross-provider synchronization operations.
 */

import workerService from '../workers';
import { MIDDLEWARE_RESULT } from '../utils/constants';

/**
 * Synchronize files between providers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 * @param {boolean} options.asMiddleware - If true, store result in req[SYNC] and call next()
 * @param {Function} next - Express next middleware function
 */
export async function synchronizeFiles(req, res, options = {}, next = null) {
  const config = {
    asMiddleware: false,
    ...options,
  };

  try {
    const {
      operations,
      source,
      target,
      sourceProvider,
      targetProvider,
      type,
      recursive,
      deleteOrphaned,
      dryRun,
      compareBy,
    } = req.body;

    let syncOperations;

    if (operations) {
      // Multiple sync operations
      if (!Array.isArray(operations)) {
        if (config.asMiddleware && next) {
          req[MIDDLEWARE_RESULT.SYNC] = {
            success: false,
            error:
              'Operations must be an array of {source, target, sourceProvider, targetProvider, ...} objects',
          };
          return next();
        }
        return res.status(400).json({
          success: false,
          error:
            'Operations must be an array of {source, target, sourceProvider, targetProvider, ...} objects',
        });
      }
      syncOperations = operations;
    } else if (source && target) {
      // Convert single sync to batch format
      syncOperations = [
        {
          source,
          target,
          sourceProvider,
          targetProvider,
          type,
          recursive: recursive || false,
          deleteOrphaned: deleteOrphaned || false,
          dryRun: dryRun || false,
          compareBy,
        },
      ];
    } else {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.SYNC] = {
          success: false,
          error:
            'Either operations array or source/target pair with providers is required',
        };
        return next();
      }
      return res.status(400).json({
        success: false,
        error:
          'Either operations array or source/target pair with providers is required',
      });
    }

    // Sync operations are ALWAYS CPU intensive and should ALWAYS use workers
    const result = await workerService.processSync(syncOperations);

    // Middleware mode: store result and call next
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.SYNC] = result;
      return next();
    }

    res.json(result);
  } catch (error) {
    console.error('Synchronization error:', error);
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.SYNC] = {
        success: false,
        error: 'Synchronization failed',
        details: error.message,
      };
      return next();
    }
    return res.status(500).json({
      success: false,
      error: 'Synchronization failed',
      details: error.message,
    });
  }
}
