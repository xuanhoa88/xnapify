/**
 * Sync Operations
 */

import { FilesystemError, createOperationResult } from '../utils';

/**
 * Sync file(s) between providers
 * @param {Object} manager - FilesystemManager instance (this)
 * @param {Object|Array} operations - Sync operation(s)
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync result
 */
export async function sync(manager, operations, options = {}) {
  try {
    const opList = Array.isArray(operations) ? operations : [operations];

    if (opList.length === 0) {
      throw new FilesystemError(
        'At least one sync operation is required',
        'INVALID_INPUT',
        400,
      );
    }

    const results = [];
    const errors = [];

    for (const op of opList) {
      try {
        const sourceProvider = manager.getProvider(op.sourceProvider);
        const targetProvider = manager.getProvider(op.targetProvider);

        const exists = await sourceProvider.exists(op.source);
        if (!exists) {
          errors.push({ ...op, error: 'SOURCE_NOT_FOUND' });
          continue;
        }

        // Get stream from source and store in target (streaming - no full buffer)
        const { stream, metadata } = await sourceProvider.retrieve(op.source);
        const targetPath = op.target || op.source;

        await targetProvider.store(targetPath, stream, {
          mimeType: metadata.mimeType,
          ...options,
        });

        results.push({
          source: op.source,
          target: targetPath,
          sourceProvider: op.sourceProvider,
          targetProvider: op.targetProvider,
          size: metadata.size,
          syncedAt: new Date().toISOString(),
        });
      } catch (error) {
        errors.push({ ...op, error: error.message });
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
      `Synced ${results.length} of ${opList.length} files`,
    );
  } catch (error) {
    if (error instanceof FilesystemError) {
      return createOperationResult(false, null, error.message, error);
    }
    return createOperationResult(
      false,
      null,
      'Sync failed',
      new FilesystemError(error.message, 'SYNC_FAILED', 500),
    );
  }
}
