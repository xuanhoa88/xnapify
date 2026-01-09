/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Rename Controller
 *
 * Handles file renaming operations.
 */

import * as filesystemActions from '../actions';
import workerService from '../workers';
import { MIDDLEWARE_RESULT } from '../utils/constants';

/**
 * Hybrid decision logic for rename operations
 * @param {Array} operations - Array of rename operations
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeRenameDecision(operations, options = {}) {
  const thresholds = {
    batchRenameThreshold: options.batchRenameThreshold || 5,
  };

  if (!Array.isArray(operations)) {
    return {
      useWorker: false,
      reason: 'Invalid operations data',
      operation: 'rename',
      timestamp: new Date().toISOString(),
    };
  }

  const useWorker = operations.length >= thresholds.batchRenameThreshold;
  const reason = useWorker
    ? `Batch rename (${operations.length} operations)`
    : 'Few operations, main process sufficient';

  return {
    useWorker,
    reason,
    operation: 'rename',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Rename files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 * @param {boolean} options.asMiddleware - If true, store result in req[RENAME] and call next()
 * @param {Function} next - Express next middleware function
 */
export async function renameFiles(req, res, options = {}, next = null) {
  const config = {
    asMiddleware: false,
    ...options,
  };

  try {
    const { operations, oldName, newName } = req.body;
    let renameOperations;

    // Parse rename operations from different formats
    if (operations) {
      if (!Array.isArray(operations)) {
        if (config.asMiddleware && next) {
          req[MIDDLEWARE_RESULT.RENAME] = {
            success: false,
            error: 'Operations must be an array of {oldName, newName} objects',
          };
          return next();
        }
        return res.status(400).json({
          success: false,
          error: 'Operations must be an array of {oldName, newName} objects',
        });
      }
      renameOperations = operations;
    } else if (oldName && newName) {
      // Convert single rename to batch format
      renameOperations = [{ oldName, newName }];
    } else {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.RENAME] = {
          success: false,
          error: 'Either operations array or oldName/newName pair is required',
        };
        return next();
      }
      return res.status(400).json({
        success: false,
        error: 'Either operations array or oldName/newName pair is required',
      });
    }

    // Use hybrid decision service to determine processing method
    const decision = makeRenameDecision(renameOperations, options);

    let result;
    // Use worker if decision says so OR if useWorker is explicitly set
    if (decision.useWorker || config.useWorker) {
      // Use worker service for batch rename
      result = await workerService.processRename(renameOperations, {
        forceFork: config.useWorker,
      });
    } else {
      // Use main process for few operations
      const results = await Promise.allSettled(
        renameOperations.map(async operation => {
          try {
            const result = await filesystemActions.renameFile(
              operation.oldName,
              operation.newName,
            );
            return result;
          } catch (error) {
            return {
              success: false,
              data: {
                oldName: operation.oldName,
                newName: operation.newName,
              },
              message: `Failed to rename file: ${operation.oldName}`,
              error,
            };
          }
        }),
      );

      const successful = results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => r.value);
      const failed = results
        .filter(r => r.status === 'rejected' || !r.value.success)
        .map(r => r.reason || r.value);

      result = {
        success: true,
        data: {
          successful,
          failed,
          totalOperations: renameOperations.length,
          successCount: successful.length,
          failCount: failed.length,
        },
        message: `Renamed ${successful.length} of ${renameOperations.length} files successfully`,
      };
    }

    // Middleware mode: store result and call next
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.RENAME] = result;
      return next();
    }

    res.json(result);
  } catch (error) {
    console.error('Rename error:', error);
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.RENAME] = {
        success: false,
        error: 'Rename failed',
        details: error.message,
      };
      return next();
    }
    return res.status(500).json({
      success: false,
      error: 'Rename failed',
      details: error.message,
    });
  }
}
