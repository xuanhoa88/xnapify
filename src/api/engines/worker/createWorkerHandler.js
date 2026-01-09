/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Create a worker function wrapper for same-process execution
 * @param {Function} processFunction - The processing function
 * @param {string} expectedType - Expected message type
 * @returns {Function} Worker function
 */
export function createWorkerHandler(processFunction, expectedType) {
  return async function workerFunction(message) {
    const { id, type, data } = message;

    if (type !== expectedType) {
      return {
        id,
        success: false,
        error: {
          message: `Unexpected message type: ${type}`,
          code: 'UNEXPECTED_TYPE',
        },
      };
    }

    try {
      const result = await processFunction(data);
      return {
        id,
        success: true,
        result,
      };
    } catch (error) {
      return {
        id,
        success: false,
        error: {
          message: error.message,
          code: error.code || 'WORKER_ERROR',
          stack: error.stack,
        },
      };
    }
  };
}
