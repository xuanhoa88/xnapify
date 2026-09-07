/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Rename Operations
 */

import {
  ERROR_CODES,
  FilesystemError,
  createOperationResult,
} from '../utils/index.js';

/**
 * Rename file(s)
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {Object|Array} operations - Single rename op or array of {oldName, newName}
 * @param {Object} options - Rename options
 * @returns {Promise<Object>} Rename result
 */
export async function rename(manager, operations, options = {}) {
  try {
    const opList = Array.isArray(operations) ? operations : [operations];
    const provider = manager.getProvider(options.provider);

    if (opList.length === 0) {
      throw new FilesystemError(
        'At least one rename operation is required',
        'INVALID_INPUT',
        400,
      );
    }

    const results = [];
    const errors = [];

    for (const op of opList) {
      const oldName = op.oldName || op.oldFileName;
      const newName = op.newName || op.newFileName;

      try {
        // Overwrite protection is the provider's to enforce, not this loop's:
        // asking `exists` first and moving second leaves a window in which the
        // destination is created, and `rename(2)` then replaces it without a
        // word. The providers that can decide-and-act in one step do; the
        // check below only gives the ones that cannot a cheaper, friendlier
        // failure than the move itself would.
        if (!options.overwrite && (await provider.exists(newName))) {
          errors.push({ oldName, newName, error: 'TARGET_EXISTS' });
          continue;
        }

        await provider.move(oldName, newName, {
          overwrite: Boolean(options.overwrite),
        });
        results.push({ oldName, newName, renamedAt: new Date().toISOString() });
      } catch (error) {
        errors.push({
          oldName,
          newName,
          error:
            error.code === ERROR_CODES.TARGET_EXISTS
              ? 'TARGET_EXISTS'
              : error.message,
        });
      }
    }

    return createOperationResult(
      true,
      {
        successful: results,
        failed: errors,
        totalOperations: opList.length,
        successCount: results.length,
        failCount: errors.length,
      },
      `Renamed ${results.length} of ${opList.length} files`,
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Rename failed',
      new FilesystemError(error.message, 'RENAME_FAILED', 500),
    );
  }
}
