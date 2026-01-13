/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Create a reusable validator function from a Zod schema
 *
 * @param {Object} schema - Zod schema
 * @returns {Function} Validator function
 */
export function createAdapterValidator(schema) {
  return (data, options) => {
    const validation = schema.safeParse({ data, options });
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }
    return {
      success: true,
      data: validation.data,
    };
  };
}
