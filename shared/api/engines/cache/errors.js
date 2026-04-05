/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Base Cache Error
 */
export class CacheError extends Error {
  constructor(message, code = 'CACHE_ERROR', statusCode = 500) {
    super(message);
    this.name = 'CacheError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Invalid cache adapter type
 */
export class InvalidCacheTypeError extends CacheError {
  constructor(type) {
    super(
      `Invalid cache type: "${type}". Supported types: memory, file`,
      'INVALID_CACHE_TYPE',
      400,
    );
    this.name = 'InvalidCacheTypeError';
  }
}

/**
 * Invalid namespace
 */
export class InvalidNamespaceError extends CacheError {
  constructor(message) {
    super(message, 'INVALID_NAMESPACE', 400);
    this.name = 'InvalidNamespaceError';
  }
}

/**
 * Invalid cache instance
 */
export class InvalidCacheError extends CacheError {
  constructor(message) {
    super(message, 'INVALID_CACHE', 400);
    this.name = 'InvalidCacheError';
  }
}
