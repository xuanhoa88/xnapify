/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WEBHOOK_STATUS } from './constants';

/**
 * Create a standardized error response
 *
 * @param {string} adapter - Adapter name
 * @param {Error|string} error - Error object or message
 * @param {string} code - Error code
 * @param {Object} extra - Additional fields
 * @returns {Object} Error response
 */
export function createErrorResponse(
  adapter,
  error,
  code = 'UNKNOWN_ERROR',
  extra = {},
) {
  return {
    success: false,
    status: WEBHOOK_STATUS.FAILED,
    error: {
      message: typeof error === 'string' ? error : error.message,
      code,
      ...(error.details && { details: error.details }),
    },
    timestamp: new Date().toISOString(),
    adapter,
    ...extra,
  };
}

/**
 * Create a standardized success response
 *
 * @param {string} adapter - Adapter name
 * @param {Object} data - Response data
 * @returns {Object} Success response
 */
export function createSuccessResponse(adapter, data) {
  return {
    success: true,
    status: WEBHOOK_STATUS.DELIVERED,
    ...data,
    timestamp: new Date().toISOString(),
    adapter,
  };
}

/**
 * Create a validation error response
 *
 * @param {string} adapter - Adapter name
 * @param {Object} validationError - Zod validation error
 * @returns {Object} Validation error response
 */
export function createValidationErrorResponse(adapter, validationError) {
  return createErrorResponse(
    adapter,
    {
      message: validationError.message,
      details: validationError.flatten(),
    },
    'VALIDATION_ERROR',
  );
}
