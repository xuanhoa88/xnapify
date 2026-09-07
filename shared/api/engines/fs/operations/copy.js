/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Copy Operations
 */

import {
  ERROR_CODES,
  FilesystemError,
  createOperationResult,
} from '../utils/index.js';

/**
 * Copy file(s)
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {Object|Array} operations - Single copy op or array of {source, target}
 * @param {Object} options - Copy options
 * @returns {Promise<Object>} Copy result
 */
export async function copy(manager, operations, options = {}) {
  try {
    const opList = Array.isArray(operations) ? operations : [operations];
    const provider = manager.getProvider(options.provider);

    if (opList.length === 0) {
      throw new FilesystemError(
        'At least one copy operation is required',
        'INVALID_INPUT',
        400,
      );
    }

    const results = [];
    const errors = [];

    for (const op of opList) {
      const source = op.source || op.sourceFileName;
      const target = op.target || op.targetFileName;

      try {
        // Overwrite protection belongs to the provider, not to this loop:
        // asking `exists` first and copying second leaves a window in which
        // the target is created, and the copy then replaces it without a word.
        // The check below only gives providers that cannot decide-and-act in
        // one step a cheaper, friendlier failure than the copy itself would.
        if (!options.overwrite && (await provider.exists(target))) {
          errors.push({ source, target, error: 'TARGET_EXISTS' });
          continue;
        }

        await provider.copy(source, target, {
          overwrite: Boolean(options.overwrite),
        });
        results.push({ source, target, copiedAt: new Date().toISOString() });
      } catch (error) {
        errors.push({
          source,
          target,
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
      `Copied ${results.length} of ${opList.length} files`,
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Copy failed',
      new FilesystemError(error.message, 'COPY_FAILED', 500),
    );
  }
}
