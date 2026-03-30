/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { isVerbose, logInfo, logWarn } = require('./logger');

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the operation
 */
async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries != null ? options.maxRetries : 2;
  const delay = options.delay != null ? options.delay : 1000;
  const backoff = options.backoff != null ? options.backoff : 1.5;
  const context = options.context != null ? options.context : {};

  let lastError;
  let currentDelay = delay;
  const verbose = isVerbose();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation(context);

      // Log successful retry
      if (attempt > 0) {
        logInfo(
          `✅ Succeeded after ${attempt} ${
            attempt === 1 ? 'retry' : 'retries'
          }`,
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === maxRetries) break;

      // Log retry attempt
      logWarn(
        `⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`,
      );

      if (verbose) {
        logWarn(`   Retrying in ${currentDelay}ms...`);
      }

      await sleep(currentDelay);
      currentDelay *= backoff;
    }
  }

  // All attempts failed
  throw new Error(
    `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
    { ...context, originalError: lastError, attempts: maxRetries + 1 },
  );
}

/**
 * Retry file system operations
 */
function withRetryFileSystem(operation, context = {}) {
  return withRetry(operation, {
    maxRetries: 2,
    delay: 500,
    backoff: 1.5,
    context: { ...context, type: 'filesystem' },
  });
}

/**
 * Retry build operations
 */
function withBuildRetry(operation, context = {}) {
  return withRetry(operation, {
    maxRetries: 1,
    delay: 2000,
    backoff: 1,
    context: { ...context, type: 'build' },
  });
}

module.exports = {
  withRetry,
  withRetryFileSystem,
  withBuildRetry,
};
