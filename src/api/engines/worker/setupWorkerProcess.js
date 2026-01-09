/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Setup fork mode execution for child process workers
 * @param {Function} processFunction - The processing function
 * @param {string} expectedType - Expected message type
 * @param {string} workerName - Name for logging
 */
export function setupWorkerProcess(processFunction, expectedType, workerName) {
  // Only setup if running as child process
  if (typeof process.send !== 'function') {
    return;
  }

  // Notify parent that worker is ready
  process.send({ type: 'WORKER_READY', name: workerName });

  // Handle incoming messages
  process.on('message', async message => {
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
  });

  // Handle process termination signals
  process.on('SIGTERM', () => {
    console.log(
      `${workerName} worker received SIGTERM, shutting down gracefully`,
    );
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log(
      `${workerName} worker received SIGINT, shutting down gracefully`,
    );
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', error => {
    console.error(`${workerName} Worker uncaught exception:`, error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, _promise) => {
    console.error(`${workerName} Worker unhandled rejection:`, reason);
    process.exit(1);
  });
}
