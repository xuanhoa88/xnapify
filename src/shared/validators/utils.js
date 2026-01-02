/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Helper to convert Zod errors to the backend's error format
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {Object} - Error object with field names as keys and error codes as values
 */
export function zodErrorToObject(zodError) {
  const errors = {};
  for (const issue of zodError.issues) {
    const fieldName = issue.path[0];
    if (fieldName && !errors[fieldName]) {
      errors[fieldName] = issue.message;
    }
  }
  return errors;
}

/**
 * Validate data with schema and return errors in backend format
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {Object} data - Data to validate
 * @returns {Object} - Error object (empty if valid)
 */
export function validateWithSchema(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return {};
  }
  return zodErrorToObject(result.error);
}
