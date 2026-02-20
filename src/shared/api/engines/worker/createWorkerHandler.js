/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Registry for created handlers
const handlerRegistry = new Map();

/**
 * Create a worker function wrapper for same-process execution
 * @param {Function} processFunction - The processing function
 * @param {string} expectedType - Expected message type
 * @returns {Function} Worker function with destroy method
 */
export function createWorkerHandler(processFunction, expectedType) {
  const workerFunction = async function workerFunction(message) {
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

  // Add metadata
  workerFunction.expectedType = expectedType;
  workerFunction.isActive = true;

  // Add unregister method
  workerFunction.unregister = function unregister() {
    workerFunction.isActive = false;
    handlerRegistry.delete(expectedType);
    return true;
  };

  // Register handler
  handlerRegistry.set(expectedType, workerFunction);

  return workerFunction;
}

/**
 * Unregister a worker handler by message type
 * @param {string} expectedType - The message type of the handler to unregister
 * @returns {boolean} True if handler was found and unregistered
 */
export function unregisterWorkerHandler(expectedType) {
  const handler = handlerRegistry.get(expectedType);

  if (!handler) {
    return false;
  }

  handler.isActive = false;
  handlerRegistry.delete(expectedType);
  return true;
}

/**
 * Get a registered worker handler by message type
 * @param {string} expectedType - The message type
 * @returns {Function|null} The handler or null if not found
 */
export function getWorkerHandler(expectedType) {
  return handlerRegistry.get(expectedType) || null;
}

/**
 * Check if a worker handler is registered and active
 * @param {string} expectedType - The message type
 * @returns {boolean} True if handler exists and is active
 */
export function isWorkerHandlerActive(expectedType) {
  const handler = handlerRegistry.get(expectedType);
  return handler ? handler.isActive : false;
}
