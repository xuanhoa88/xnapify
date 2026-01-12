/**
 * Copy Operations
 */

import { FilesystemError, createResponse } from '../utils';

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
        // Check target exists for overwrite protection
        if (!options.overwrite) {
          const targetExists = await provider.exists(target);
          if (targetExists) {
            errors.push({ source, target, error: 'TARGET_EXISTS' });
            continue;
          }
        }

        await provider.copy(source, target);
        results.push({ source, target, copiedAt: new Date().toISOString() });
      } catch (error) {
        errors.push({ source, target, error: error.message });
      }
    }

    return createResponse(
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
      return createResponse(false, null, error.message, error);
    }
    return createResponse(
      false,
      null,
      'Copy failed',
      new FilesystemError(error.message, 'COPY_FAILED', 500),
    );
  }
}
