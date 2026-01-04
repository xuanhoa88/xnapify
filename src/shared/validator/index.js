/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import i18n, { addNamespace, getTranslations } from '../i18n';
import { formatZodErrorToObject } from './formatter';

// Register validator translations with the i18n system
addNamespace(
  'zod',
  getTranslations(require.context('./translations', false, /\.json$/i)),
);

/**
 * Validate form data and return errors array (empty if valid)
 *
 * @param {Function} schema - Factory function that receives { i18n, z } and returns Zod schema
 * @param {Object} data - Form data to validate
 * @returns {[boolean, Object]} - Tuple [isValid, errors]. errors is undefined if valid.
 *
 * @example
 * const [isValid, errors] = validateForm(loginFormSchema, { email, password });
 * if (!isValid) {
 *   return http.sendValidationError(res, errors[0]);
 * }
 */
export function validateForm(schema, data) {
  let zodSchema;

  // Call schema factory and handle any errors
  try {
    zodSchema = schema({ i18n, z });
  } catch (error) {
    // Schema factory threw an error - return in same format as validation errors (array)
    return [
      false,
      {
        _schema: [`Schema validation failed: ${error.message}`],
      },
    ];
  }

  // Validate that we got a valid Zod schema with safeParse method
  if (!zodSchema || typeof zodSchema.safeParse !== 'function') {
    return [
      false,
      {
        _schema: [
          'Invalid schema: schema factory must return a Zod schema object',
        ],
      },
    ];
  }

  // Validate data using safeParse (never throws)
  const result = zodSchema.safeParse(data);

  if (result.success) {
    return [true];
  }

  // Return error messages as arrays (same format as schema errors above)
  return [
    false,
    formatZodErrorToObject(result.error, { combineMessages: false }),
  ];
}

// Export all formatter utilities
export * from './formatter';

// Export Zod instance
export { z };
