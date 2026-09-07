/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Base Broker Error
 */
export class BrokerError extends Error {
  constructor(message, code = 'BROKER_ERROR', statusCode = 500) {
    super(message);
    this.name = 'BrokerError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Invalid broker adapter type
 */
export class InvalidBrokerTypeError extends BrokerError {
  constructor(type) {
    super(
      `Invalid broker type: "${type}". Supported types: memory, file, redis`,
      'INVALID_BROKER_TYPE',
      400,
    );
    this.name = 'InvalidBrokerTypeError';
  }
}
