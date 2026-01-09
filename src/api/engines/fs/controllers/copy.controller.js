/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Copy Controller
 *
 * Handles file copying operations.
 */

import * as filesystemActions from '../actions';
import workerService from '../workers';
import { MIDDLEWARE_RESULT } from '../utils/constants';

/**
 * Hybrid decision logic for copy operations
 * @param {Array} operations - Array of copy operations
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeCopyDecision(operations, options = {}) {
  const thresholds = {
    batchCopyThreshold: options.batchCopyThreshold || 3,
  };

  if (!Array.isArray(operations)) {
    return {
      shouldUseWorker: false,
      reason: 'Invalid operations data',
      operation: 'copy',
      timestamp: new Date().toISOString(),
    };
  }

  const shouldUseWorker = operations.length >= thresholds.batchCopyThreshold;
  const reason = shouldUseWorker
    ? `Batch copy (${operations.length} operations)`
    : 'Few operations, main process sufficient';

  return {
    shouldUseWorker,
    reason,
    operation: 'copy',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Copy files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 * @param {boolean} options.asMiddleware - If true, store result in req[COPY] and call next()
 * @param {Function} next - Express next middleware function
 */
export async function copyFiles(req, res, options = {}, next = null) {
  const config = {
    asMiddleware: false,
    ...options,
  };

  try {
    const { operations, sourceFileName, targetFileName } = req.body;
    let copyOperations;

    // Parse copy operations from different formats
    if (operations) {
      if (!Array.isArray(operations)) {
        if (config.asMiddleware && next) {
          req[MIDDLEWARE_RESULT.COPY] = {
            success: false,
            error:
              'Operations must be an array of {sourceFileName, targetFileName} objects',
          };
          return next();
        }
        return res.status(400).json({
          success: false,
          error:
            'Operations must be an array of {sourceFileName, targetFileName} objects',
        });
      }
      copyOperations = operations;
    } else if (sourceFileName && targetFileName) {
      // Convert single copy to batch format
      copyOperations = [{ sourceFileName, targetFileName }];
    } else {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.COPY] = {
          success: false,
          error:
            'Either operations array or sourceFileName/targetFileName pair is required',
        };
        return next();
      }
      return res.status(400).json({
        success: false,
        error:
          'Either operations array or sourceFileName/targetFileName pair is required',
      });
    }

    // Use hybrid decision service to determine processing method
    const decision = makeCopyDecision(copyOperations, options);

    let result;
    if (decision.shouldUseWorker) {
      // Use worker service for batch copy
      result = await workerService.processCopy(copyOperations, {
        overwrite: req.body.overwrite || false,
      });
    } else {
      // Use main process for few operations
      const results = await Promise.allSettled(
        copyOperations.map(async operation => {
          try {
            const result = await filesystemActions.copyFile(
              operation.sourceFileName,
              operation.targetFileName,
              {
                overwrite: req.body.overwrite || false,
              },
            );
            return result;
          } catch (error) {
            return {
              success: false,
              data: {
                sourceFileName: operation.sourceFileName,
                targetFileName: operation.targetFileName,
              },
              message: `Failed to copy file: ${operation.sourceFileName}`,
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
          totalOperations: copyOperations.length,
          successCount: successful.length,
          failCount: failed.length,
        },
        message: `Copied ${successful.length} of ${copyOperations.length} files successfully`,
      };
    }

    // Middleware mode: store result and call next
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.COPY] = result;
      return next();
    }

    res.json(result);
  } catch (error) {
    console.error('Copy error:', error);
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.COPY] = {
        success: false,
        error: 'Copy failed',
        details: error.message,
      };
      return next();
    }
    return res.status(500).json({
      success: false,
      error: 'Copy failed',
      details: error.message,
    });
  }
}
