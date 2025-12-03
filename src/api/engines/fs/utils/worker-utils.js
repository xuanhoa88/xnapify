/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { FilesystemWorkerError } from '../utils';

/**
 * Setup fork mode execution for worker processes
 *
 * @param {Function} processFunction - Function to process worker messages
 * @param {string} messageType - Expected message type
 * @param {string} workerName - Worker name for logging
 */
export function setupForkMode(processFunction, messageType, workerName) {
  // Only run in child process (fork mode)
  if (process.send) {
    // Handle incoming messages from parent process
    process.on('message', async message => {
      try {
        const { type, data, id } = message;

        if (type === messageType) {
          const result = await processFunction(data);
          process.send({
            id,
            success: true,
            result,
          });
        } else {
          process.send({
            id: message.id,
            success: false,
            error: {
              message: `Unknown message type: ${type}`,
              code: 'UNKNOWN_MESSAGE_TYPE',
            },
          });
        }
      } catch (error) {
        process.send({
          id: message.id,
          success: false,
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code || 'WORKER_ERROR',
          },
        });
      }
    });

    // Handle process termination
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

    // Notify parent that worker is ready
    process.send({ type: 'WORKER_READY' });
  }
}

/**
 * Create worker function for same-process execution
 *
 * @param {Function} processFunction - Function to process worker messages
 * @param {string} messageType - Expected message type
 * @returns {Function} Worker function for same-process execution
 */
export function createWorker(processFunction, messageType) {
  return async function workerFunction(message) {
    try {
      const { type, data, id } = message;

      let result;
      switch (type) {
        case messageType:
          result = await processFunction(data);
          break;

        default:
          throw new FilesystemWorkerError(`Unknown message type: ${type}`);
      }

      return {
        id,
        success: true,
        result,
      };
    } catch (error) {
      return {
        id: message.id,
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
        },
      };
    }
  };
}
