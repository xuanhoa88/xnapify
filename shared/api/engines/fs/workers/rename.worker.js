/**
 * Rename Worker - Handles file rename operations
 * Supports both same-process and child process execution
 */

import { createFactory } from '../factory';
import { FilesystemWorkerError } from '../utils';

/**
 * Process rename operations
 * @param {Object} data - Rename data
 * @returns {Promise<Object>} Rename result
 */
async function processRename(data) {
  const { type, operations, options = {} } = data;
  const fs = createFactory(options);

  switch (type) {
    case 'RENAME_SINGLE': {
      const { oldName, newName, options: singleOptions } = operations;
      return await fs.rename(
        { oldName, newName },
        { ...(singleOptions || options), useWorker: false },
      );
    }

    case 'RENAME_BATCH':
      return await fs.rename(operations.renameOperations, {
        ...operations.options,
        useWorker: false,
      });

    default:
      throw new FilesystemWorkerError(`Unknown rename type: ${type}`);
  }
}

// Create worker function using helper

export { processRename as RENAME_FILES };
export default processRename;
