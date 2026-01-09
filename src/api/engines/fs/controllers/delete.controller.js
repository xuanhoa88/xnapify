/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Delete Controller
 *
 * Handles file deletion operations.
 */

import * as filesystemActions from '../actions';
import workerService from '../workers';
import { MIDDLEWARE_RESULT } from '../utils/constants';

/**
 * Hybrid decision logic for delete operations
 * @param {Array} fileNames - Array of file names
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeDeleteDecision(fileNames, options = {}) {
  const thresholds = {
    batchDeleteThreshold: options.batchDeleteThreshold || 10,
  };

  if (!Array.isArray(fileNames)) {
    return {
      useWorker: false,
      reason: 'Invalid file names data',
      operation: 'delete',
      timestamp: new Date().toISOString(),
    };
  }

  const useWorker = fileNames.length >= thresholds.batchDeleteThreshold;
  const reason = useWorker
    ? `Batch delete (${fileNames.length} files)`
    : 'Few files, main process sufficient';

  return {
    useWorker,
    reason,
    operation: 'delete',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Delete files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 * @param {boolean} options.asMiddleware - If true, store result in req[DELETE] and call next()
 * @param {Function} next - Express next middleware function
 */
export async function deleteFiles(req, res, options = {}, next = null) {
  const config = {
    asMiddleware: false,
    ...options,
  };

  try {
    const { files, fileName } = req.body;
    let fileNames;

    // Parse file names from different formats
    if (files) {
      fileNames = Array.isArray(files) ? files : [files];
    } else if (fileName) {
      fileNames = Array.isArray(fileName) ? fileName : [fileName];
    } else {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.DELETE] = {
          success: false,
          error: 'Either files array or fileName is required',
        };
        return next();
      }
      return res.status(400).json({
        success: false,
        error: 'Either files array or fileName is required',
      });
    }

    // Use hybrid decision service to determine processing method
    const decision = makeDeleteDecision(fileNames, options);

    let result;
    // Use worker if decision says so OR if useWorker is explicitly set
    if (decision.useWorker || config.useWorker) {
      // Use worker service for batch delete
      result = await workerService.processDelete(fileNames, {
        forceFork: config.useWorker,
      });
    } else {
      // Use main process for few files
      const results = await Promise.allSettled(
        fileNames.map(async fileName => {
          try {
            const result = await filesystemActions.deleteFile(fileName);
            return result;
          } catch (error) {
            return {
              success: false,
              data: { fileName },
              message: `Failed to delete file: ${fileName}`,
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
          totalFiles: fileNames.length,
          successCount: successful.length,
          failCount: failed.length,
        },
        message: `Deleted ${successful.length} of ${fileNames.length} files successfully`,
      };
    }

    // Middleware mode: store result and call next
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.DELETE] = result;
      return next();
    }

    res.json(result);
  } catch (error) {
    console.error('Delete error:', error);
    if (config.asMiddleware && next) {
      req[MIDDLEWARE_RESULT.DELETE] = {
        success: false,
        error: 'Delete failed',
        details: error.message,
      };
      return next();
    }
    return res.status(500).json({
      success: false,
      error: 'Delete failed',
      details: error.message,
    });
  }
}
