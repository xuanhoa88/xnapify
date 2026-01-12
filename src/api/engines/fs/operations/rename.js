/**
 * Rename Operations
 */

import { FilesystemError, createOperationResult } from '../utils';

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
        // Check target exists for overwrite protection
        if (!options.overwrite) {
          const targetExists = await provider.exists(newName);
          if (targetExists) {
            errors.push({ oldName, newName, error: 'TARGET_EXISTS' });
            continue;
          }
        }

        await provider.move(oldName, newName);
        results.push({ oldName, newName, renamedAt: new Date().toISOString() });
      } catch (error) {
        errors.push({ oldName, newName, error: error.message });
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
