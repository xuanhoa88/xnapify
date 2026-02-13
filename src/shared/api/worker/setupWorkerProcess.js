/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Store registered handlers for cleanup on the global object so they survive
// module reloads (e.g. HMR). This prevents accumulating process listeners.
const WORKER_REGISTRY_SYMBOL = Symbol.for('__rsk.workerRegisteredHandlers__');
const registeredHandlers =
  global[WORKER_REGISTRY_SYMBOL] ||
  (global[WORKER_REGISTRY_SYMBOL] = new Map());

// Configuration constants
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000; // 1 second
const MAX_REGISTRY_SIZE = 100;

/**
 * @typedef {Object} WorkerConfig
 * @property {number} [timeoutMs=30000] - Timeout for processing function
 * @property {number} [maxRetries=3] - Maximum retry attempts on timeout/failure
 * @property {number} [retryDelayMs=1000] - Delay between retries
 * @property {boolean} [enableLogging=true] - Enable debug logging
 * @property {boolean} [sanitizeErrors=true] - Remove sensitive paths from stack traces
 */

/**
 * @typedef {Object} MessageData
 * @property {string} id - Message identifier
 * @property {string} type - Message type
 * @property {*} data - Message payload
 * @property {number} [timeout] - Override default timeout
 * @property {number} [retryAttempt=0] - Current retry attempt number
 */

/**
 * Safe process.send wrapper that handles disconnection
 * @param {Object} message - Message to send
 * @returns {boolean} True if message was sent successfully
 */
export function safeSend(message) {
  if (!process.send || !process.connected) {
    console.warn('Cannot send message: process not connected');
    return false;
  }

  try {
    process.send(message);
    return true;
  } catch (error) {
    console.error('Failed to send message:', error.message);
    return false;
  }
}

/**
 * Sanitize error stack traces to remove sensitive information
 * @param {string} stack - Error stack trace
 * @returns {string} Sanitized stack trace
 */
export function sanitizeStack(stack) {
  if (!stack) return '';

  // Remove absolute paths, keep only relative paths and line numbers
  return stack
    .split('\n')
    .map(line => {
      // Replace absolute paths with relative ones
      return line.replace(/\(.*[\\/\\]([^\\/\\]+:[0-9]+:[0-9]+)\)/, '($1)');
    })
    .join('\n');
}

/**
 * Validate incoming message structure
 * @param {*} message - Message to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }

  if (!message.id || typeof message.id !== 'string') {
    return { valid: false, error: 'Message must have a string id' };
  }

  if (!message.type || typeof message.type !== 'string') {
    return { valid: false, error: 'Message must have a string type' };
  }

  return { valid: true };
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with timeout and retry logic
 * @param {Function} fn - Function to execute
 * @param {*} data - Data to pass to function
 * @param {WorkerConfig} config - Worker configuration
 * @param {number} retryAttempt - Current retry attempt
 * @returns {Promise<*>} Function result
 */
async function executeWithTimeoutAndRetry(fn, data, config, retryAttempt = 0) {
  const timeoutMs = data.timeout || config.timeoutMs;

  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          Object.assign(new Error(`Processing timeout after ${timeoutMs}ms`), {
            code: 'TIMEOUT',
          }),
        );
      }, timeoutMs);
    });

    // Race between actual execution and timeout
    const result = await Promise.race([fn(data), timeoutPromise]);

    return { result, retryAttempt };
  } catch (error) {
    // Check if we should retry
    const shouldRetry =
      (error.code === 'TIMEOUT' || error.retryable === true) &&
      retryAttempt < config.maxRetries;

    if (shouldRetry) {
      if (config.enableLogging) {
        console.warn(
          `Retry attempt ${retryAttempt + 1}/${config.maxRetries} ` +
            `after ${error.code || 'error'}`,
        );
      }

      // Exponential backoff: delay * (2 ^ retryAttempt)
      const delay = config.retryDelayMs * Math.pow(2, retryAttempt);
      await sleep(delay);

      // Recursive retry
      return executeWithTimeoutAndRetry(fn, data, config, retryAttempt + 1);
    }

    // No more retries or non-retryable error
    if (retryAttempt > 0) {
      error.message = `Failed after ${retryAttempt + 1} attempts: ${error.message}`;
      error.totalAttempts = retryAttempt + 1;
    }

    throw error;
  }
}

/**
 * Setup fork mode execution for child process workers
 * @param {Function} processFunction - The processing function
 * @param {string} expectedType - Expected message type
 * @param {string} workerName - Name for logging
 * @param {WorkerConfig} [config={}] - Worker configuration
 * @returns {Function} Cleanup function to remove handlers
 */
export function setupWorkerProcess(
  processFunction,
  expectedType,
  workerName,
  config = {},
) {
  // Merge with defaults
  const workerConfig = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    enableLogging: true,
    sanitizeErrors: true,
    ...config,
  };

  // Only setup if running as child process
  if (typeof process.send !== 'function') {
    if (workerConfig.enableLogging) {
      console.info(
        `[${workerName}] Not running as child process, skipping setup`,
      );
    }
    return () => {}; // Return no-op cleanup
  }

  // Check registry size to prevent memory leaks
  if (registeredHandlers.size >= MAX_REGISTRY_SIZE) {
    console.error(
      `Worker registry full (${MAX_REGISTRY_SIZE}), ` +
        `possible memory leak detected`,
    );
    throw new Error('Worker registry size limit exceeded');
  }

  // Check if worker is already registered and clean up previous instance
  if (registeredHandlers.has(workerName)) {
    if (workerConfig.enableLogging) {
      console.info(`🔄 [${workerName}] Reloading worker handlers...`);
    }
    unregisterWorkerProcess(workerName);
  }

  // Message handler with validation, timeout, and retry
  const handleMessage = async message => {
    // Validate message structure
    const validation = validateMessage(message);
    if (!validation.valid) {
      if (workerConfig.enableLogging) {
        console.warn(`[${workerName}] Invalid message:`, validation.error);
      }

      safeSend({
        id: (message && message.id) || 'unknown',
        success: false,
        error: {
          message: validation.error,
          code: 'INVALID_MESSAGE',
        },
      });
      return;
    }

    const { id, type, data } = message;

    // Check message type
    if (type !== expectedType) {
      if (workerConfig.enableLogging) {
        console.warn(
          `[${workerName}] Unexpected type: ${type}, expected: ${expectedType}`,
        );
      }

      safeSend({
        id,
        success: false,
        error: {
          message: `Unexpected message type: ${type}`,
          code: 'UNEXPECTED_TYPE',
        },
      });
      return;
    }

    if (workerConfig.enableLogging) {
      console.debug(`[${workerName}] Processing message ${id}`);
    }

    const startTime = Date.now();

    try {
      // Execute with timeout and retry
      const { result, retryAttempt } = await executeWithTimeoutAndRetry(
        processFunction,
        data,
        workerConfig,
        message.retryAttempt || 0,
      );

      const duration = Date.now() - startTime;

      if (workerConfig.enableLogging) {
        console.debug(
          `[${workerName}] Completed message ${id} in ${duration}ms`,
        );
      }

      safeSend({
        id,
        success: true,
        result,
        meta: {
          duration,
          retries: retryAttempt,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      if (workerConfig.enableLogging) {
        console.error(
          `[${workerName}] Error processing message ${id}:`,
          error.message,
        );
      }

      safeSend({
        id,
        success: false,
        error: {
          message: error.message,
          code: error.code || 'WORKER_ERROR',
          stack: workerConfig.sanitizeErrors
            ? sanitizeStack(error.stack)
            : error.stack,
          totalAttempts: error.totalAttempts || 1,
        },
        meta: {
          duration,
        },
      });
    }
  };

  const handleUncaughtException = error => {
    console.error(`[${workerName}] Worker uncaught exception:`, error);

    // Attempt graceful cleanup before exit
    try {
      unregisterWorkerProcess(workerName);
    } catch (cleanupError) {
      console.error(`[${workerName}] Cleanup error:`, cleanupError);
    }

    process.exit(1);
  };

  const handleUnhandledRejection = (reason, promise) => {
    console.error(`[${workerName}] Worker unhandled rejection:`, reason);
    console.error('Promise:', promise);

    // Attempt graceful cleanup before exit
    try {
      unregisterWorkerProcess(workerName);
    } catch (cleanupError) {
      console.error(`[${workerName}] Cleanup error:`, cleanupError);
    }

    process.exit(1);
  };

  const handleDisconnect = () => {
    if (workerConfig.enableLogging) {
      console.warn(
        `[${workerName}] Parent process disconnected, cleaning up...`,
      );
    }
    unregisterWorkerProcess(workerName);
  };

  // Register handlers
  process.on('message', handleMessage);
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('disconnect', handleDisconnect);

  // Store handlers for cleanup
  const handlers = {
    message: handleMessage,
    uncaughtException: handleUncaughtException,
    unhandledRejection: handleUnhandledRejection,
    disconnect: handleDisconnect,
  };
  registeredHandlers.set(workerName, handlers);

  // Notify parent that worker is ready
  safeSend({
    type: 'WORKER_READY',
    name: workerName,
    config: {
      timeoutMs: workerConfig.timeoutMs,
      maxRetries: workerConfig.maxRetries,
      retryDelayMs: workerConfig.retryDelayMs,
    },
  });

  if (workerConfig.enableLogging) {
    console.info(`✅ [${workerName}] Worker ready and listening`);
  }

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

  // Remove all handlers safely
  if (typeof handlers.message === 'function') {
    process.off('message', handlers.message);
  }
  if (typeof handlers.uncaughtException === 'function') {
    process.off('uncaughtException', handlers.uncaughtException);
  }
  if (typeof handlers.unhandledRejection === 'function') {
    process.off('unhandledRejection', handlers.unhandledRejection);
  }
  if (typeof handlers.disconnect === 'function') {
    process.off('disconnect', handlers.disconnect);
  }

  // Clear from registry
  registeredHandlers.delete(workerName);

  console.info(`🧹 [${workerName}] Worker handlers unregistered`);

  return true;
}

/**
 * Get a registered worker process by name
 * @param {string} workerName - The worker name
 * @returns {boolean} True if worker is registered (handlers not exposed for security)
 */
export function getWorkerProcess(workerName) {
  return registeredHandlers.has(workerName);
}

/**
 * Check if a worker process is registered
 * @param {string} workerName - The worker name
 * @returns {boolean} True if worker process is registered
 */
export function isWorkerProcessActive(workerName) {
  return registeredHandlers.has(workerName);
}

/**
 * Get all registered worker names
 * @returns {string[]} Array of registered worker names
 */
export function getRegisteredWorkers() {
  return Array.from(registeredHandlers.keys());
}

/**
 * Unregister all workers (useful for testing or shutdown)
 * @returns {number} Number of workers unregistered
 */
export function unregisterAllWorkers() {
  const workers = getRegisteredWorkers();
  workers.forEach(name => unregisterWorkerProcess(name));
  return workers.length;
}
