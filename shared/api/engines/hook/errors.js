/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Error thrown when an invalid channel name is provided.
 */
export class InvalidChannelNameError extends Error {
  constructor(message) {
    super(message || 'Channel name must be a non-empty string');
    this.name = 'InvalidChannelNameError';
    this.code = 'ERR_INVALID_CHANNEL_NAME';
    this.statusCode = 400;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when execution is aborted via AbortSignal.
 */
export class HookAbortError extends Error {
  constructor(message) {
    super(message || 'Execution aborted');
    this.name = 'AbortError';
    this.code = 'ERR_HOOK_ABORTED';
    this.statusCode = 499;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when multiple handlers fail during emit().
 * Falls back to a plain Error with .errors array on Node 16 (no native AggregateError).
 *
 * @param {Error[]} errors - Array of caught errors
 * @param {string} message - Descriptive message
 * @returns {AggregateError|Error}
 */
export function createAggregateError(errors, message) {
  if (typeof AggregateError !== 'undefined') {
    return new AggregateError(errors, message);
  }

  const err = new Error(message);
  err.name = 'AggregateError';
  err.errors = errors;
  return err;
}
