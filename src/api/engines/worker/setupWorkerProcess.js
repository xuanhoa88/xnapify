/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Store registered handlers for cleanup
const registeredHandlers = new Map();

/**
 * Setup fork mode execution for child process workers
 * @param {Function} processFunction - The processing function
 * @param {string} expectedType - Expected message type
 * @param {string} workerName - Name for logging
 * @returns {Function} Cleanup function to remove handlers
 */
export function setupWorkerProcess(processFunction, expectedType, workerName) {
  // Only setup if running as child process
  if (typeof process.send !== 'function') {
    return () => {}; // Return no-op cleanup
  }

  // Message handler
  const messageHandler = async message => {
    const { id, type, data } = message;

    if (type !== expectedType) {
      process.send({
        id,
        success: false,
        error: {
          message: `Unexpected message type: ${type}`,
          code: 'UNEXPECTED_TYPE',
        },
      });
      return;
    }

    try {
      const result = await processFunction(data);
      process.send({
        id,
        success: true,
        result,
      });
    } catch (error) {
      process.send({
        id,
        success: false,
        error: {
          message: error.message,
          code: error.code || 'WORKER_ERROR',
          stack: error.stack,
        },
      });
    }
  };

  // Signal handlers
  const sigtermHandler = () => {
    console.log(
      `${workerName} worker received SIGTERM, shutting down gracefully`,
    );
    process.exit(0);
  };

  const sigintHandler = () => {
    console.log(
      `${workerName} worker received SIGINT, shutting down gracefully`,
    );
    process.exit(0);
  };

  const uncaughtHandler = error => {
    console.error(`${workerName} Worker uncaught exception:`, error);
    process.exit(1);
  };

  const unhandledHandler = (reason, _promise) => {
    console.error(`${workerName} Worker unhandled rejection:`, reason);
    process.exit(1);
  };

  // Register handlers
  process.on('message', messageHandler);
  process.on('SIGTERM', sigtermHandler);
  process.on('SIGINT', sigintHandler);
  process.on('uncaughtException', uncaughtHandler);
  process.on('unhandledRejection', unhandledHandler);

  // Store handlers for cleanup
  const handlers = {
    message: messageHandler,
    SIGTERM: sigtermHandler,
    SIGINT: sigintHandler,
    uncaughtException: uncaughtHandler,
    unhandledRejection: unhandledHandler,
  };
  registeredHandlers.set(workerName, handlers);

  // Notify parent that worker is ready
  process.send({ type: 'WORKER_READY', name: workerName });

  // Return cleanup function
  return () => unregisterWorkerProcess(workerName);
}

/**
 * Unregister all handlers registered by setupWorkerProcess
 * @param {string} workerName - Name of the worker to unregister
 * @returns {boolean} True if handlers were removed
 */
export function unregisterWorkerProcess(workerName) {
  const handlers = registeredHandlers.get(workerName);

  if (!handlers) {
    return false;
  }

  // Remove all handlers
  process.off('message', handlers.message);
  process.off('SIGTERM', handlers.SIGTERM);
  process.off('SIGINT', handlers.SIGINT);
  process.off('uncaughtException', handlers.uncaughtException);
  process.off('unhandledRejection', handlers.unhandledRejection);

  // Clear from registry
  registeredHandlers.delete(workerName);

  return true;
}

/**
 * Get a registered worker process by name
 * @param {string} workerName - The worker name
 * @returns {Object|null} The handlers object or null if not found
 */
export function getWorkerProcess(workerName) {
  return registeredHandlers.get(workerName) || null;
}

/**
 * Check if a worker process is registered
 * @param {string} workerName - The worker name
 * @returns {boolean} True if worker process is registered
 */
export function isWorkerProcessActive(workerName) {
  return registeredHandlers.has(workerName);
}
