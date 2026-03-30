/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Error formatting utilities inspired by zod-error package
 * Provides flexible error formatting for different contexts
 */

// =============================================================================
// ERROR FORMATTING OPTIONS
// =============================================================================

/**
 * Default options for error formatting
 * @typedef {Object} ErrorFormattingOptions
 * @property {string} prefix - String to prepend to error messages
 * @property {string} delimiter - Separator between field and message
 * @property {string} separator - Separator between multiple errors
 * @property {boolean} includePath - Whether to include the field path
 * @property {boolean} includeCode - Whether to include the error code
 * @property {number} maxErrors - Maximum number of errors to include (0 = all)
 */
const defaultOptions = Object.freeze({
  prefix: '',
  delimiter: ': ',
  separator: '\n',
  includePath: true,
  includeCode: false,
  maxErrors: 0,
});

// Key for root-level errors
const ROOT_KEY = '_root';

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

/**
 * Format Zod error into a single concatenated string
 * Inspired by zod-error's generateErrorMessage
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @param {ErrorFormattingOptions} options - Formatting options
 * @returns {string} Formatted error message string
 *
 * @example
 * const errorMessage = formatZodError(error, {
 *   prefix: 'Validation failed',
 *   separator: '; ',
 *   maxErrors: 3
 * });
 * // "Validation failed: email: Email is required; password: Password is required"
 */
export function formatZodError(zodError, options = {}) {
  const opts = { ...defaultOptions, ...options };

  if (!zodError || !zodError.issues || zodError.issues.length === 0) {
    return '';
  }

  // Limit number of errors if maxErrors is set
  const limitedError =
    opts.maxErrors > 0
      ? { ...zodError, issues: zodError.issues.slice(0, opts.maxErrors) }
      : zodError;

  // Use formatZodErrorToObject to get grouped errors (combined as strings)
  const errorObject = formatZodErrorToObject(limitedError, {
    combineMessages: true,
    delimiter: opts.delimiter,
  });

  // Convert error object to formatted strings
  const formattedParts = Object.entries(errorObject).map(([field, message]) => {
    const parts = [];

    // Add prefix if specified
    if (opts.prefix) {
      parts.push(opts.prefix);
    }

    // Add field path if enabled and not root
    if (opts.includePath && field !== ROOT_KEY) {
      parts.push(field);
    }

    // Add delimiter between field and message
    if (parts.length > 0) {
      parts.push(opts.delimiter);
    }

    // Add the error message
    parts.push(message);

    return parts.join('').trim();
  });

  return formattedParts.join(opts.separator);
}

/**
 * Convert Zod error to a structured object grouped by field
 *
 * By default, returns arrays of error messages for each field.
 * With combineMessages option, combines multiple errors into a single string.
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @param {Object} options - Options
 * @param {boolean} options.combineMessages - Combine multiple errors into single string (default: false)
 * @param {string} options.delimiter - Delimiter for combining multiple messages (default: '; ')
 * @returns {Object} Object with field names as keys and error messages (string or array) as values
 *
 * @example
 * // Default: returns arrays
 * const errors = formatZodErrorToObject(error);
 * // { email: ["Email is required", "Email must be valid"], password: ["Password is required"] }
 *
 * // With combineMessages: returns combined strings
 * const errors = formatZodErrorToObject(error, { combineMessages: true });
 * // { email: "Email is required; Email must be valid", password: "Password is required" }
 */
export function formatZodErrorToObject(zodError, options = {}) {
  const { combineMessages = false, delimiter = '; ' } = options;

  if (!zodError || !zodError.issues || zodError.issues.length === 0) {
    return {};
  }

  const errors = {};

  for (const issue of zodError.issues) {
    const fieldName = issue.path[0] || ROOT_KEY;
    const message = issue.message || 'zod:errors.VALIDATION_ERROR'; // Fallback if message is missing

    if (!errors[fieldName]) {
      // First error for this field - initialize as array
      errors[fieldName] = [message];
    } else {
      // Additional error - push to array
      errors[fieldName].push(message);
    }
  }

  // If combineMessages is true, convert arrays to combined strings
  if (combineMessages) {
    for (const fieldName in errors) {
      errors[fieldName] = errors[fieldName].join(delimiter);
    }
  }

  return errors;
}

/**
 * Format Zod error into an array of error objects
 * Useful for structured error responses or UI rendering
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {Array<Object>} Array of error objects with field, message, and code
 *
 * @example
 * const errors = formatZodErrorToArray(error);
 * // [
 * //   { field: 'email', message: 'Email is required', code: 'too_small' },
 * //   { field: 'password', message: 'Password is required', code: 'too_small' }
 * // ]
 */
export function formatZodErrorToArray(zodError) {
  if (!zodError || !zodError.issues || zodError.issues.length === 0) {
    return [];
  }

  return zodError.issues.map(issue => ({
    field: issue.path.length > 0 ? issue.path.join('.') : ROOT_KEY,
    message: issue.message,
    code: issue.code,
    path: issue.path,
  }));
}

/**
 * Get all error messages from a Zod error
 * Useful for displaying all validation errors
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @param {string} fieldName - Optional field name to get errors for
 * @returns {string[]} Array of error messages
 *
 * @example
 * const allErrors = getZodErrors(error);
 * // ["Email is required", "Password is required"]
 *
 * const emailErrors = getZodErrors(error, 'email');
 * // ["Email is required", "Email must be valid"]
 */
export function getZodErrors(zodError, fieldName = null) {
  if (!zodError || !zodError.issues || zodError.issues.length === 0) {
    return [];
  }

  if (fieldName) {
    // For a specific field, filter and get all messages
    return zodError.issues
      .filter(issue => issue.path[0] === fieldName)
      .map(issue => issue.message);
  }

  // Get all errors using formatZodErrorToObject (returns arrays)
  const errorObject = formatZodErrorToObject(zodError);

  // Flatten all error arrays into a single array
  return Object.values(errorObject).flat();
}

/**
 * Check if a specific field has errors
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field has errors
 */
export function hasFieldError(zodError, fieldName) {
  if (!zodError || !zodError.issues || zodError.issues.length === 0) {
    return false;
  }

  const errorObject = formatZodErrorToObject(zodError);
  return fieldName in errorObject;
}
