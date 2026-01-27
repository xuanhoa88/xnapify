/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import i18n from '../i18n/instance';
import { addNamespace } from '../i18n/addNamespace';
import { getTranslations } from '../i18n/getTranslations';
import { formatZodErrorToObject } from './formatter';

// Auto-load validator translations via require.context
addNamespace(
  'zod',
  getTranslations(require.context('./translations', false, /\.json$/i)),
);

/**
 * Helper function to translate a value with optional prefix
 * @param {string} value - The value to translate
 * @param {Object} options - Translation options
 * @param {string} options.prefix - Prefix namespace for the translation key
 * @returns {string} Translated value or original value if translation not found
 */
function translateLabel(value, options = {}) {
  const t = i18n.t.bind(i18n);
  const { prefix } = options;

  if (prefix) {
    const key = `zod.${prefix}.${value}`;
    const translated = t(key, { defaultValue: value });
    return translated !== key ? translated : value;
  }
  return value;
}

/**
 * Comprehensive Zod error map following zod-vue-i18n patterns
 * Translates Zod validation errors using i18n with support for:
 * - All ZodIssueCode types
 * - Type-based too_small/too_big messages
 * - Custom i18n keys via params.i18n
 * - Path context for field-specific messages
 */
z.setErrorMap((issue, ctx) => {
  const t = i18n.t.bind(i18n);
  let messageKey;
  let options = {};

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      // Handle undefined/null as required field errors
      if (issue.received === 'undefined') {
        messageKey = 'zod.errors.invalid_type_received_undefined';
      } else if (issue.received === 'null') {
        messageKey = 'zod.errors.invalid_type_received_null';
      } else {
        messageKey = 'zod.errors.invalid_type';
        options = {
          expected: translateLabel(issue.expected, { prefix: 'types' }),
          received: translateLabel(issue.received, { prefix: 'types' }),
        };
      }
      break;

    case z.ZodIssueCode.invalid_literal:
      messageKey = 'zod.errors.invalid_literal';
      options = {
        expected: JSON.stringify(issue.expected),
      };
      break;

    case z.ZodIssueCode.unrecognized_keys:
      messageKey = 'zod.errors.unrecognized_keys';
      options = {
        keys: issue.keys.join(', '),
        count: issue.keys.length,
      };
      break;

    case z.ZodIssueCode.invalid_union:
      messageKey = 'zod.errors.invalid_union';
      break;

    case z.ZodIssueCode.invalid_union_discriminator:
      messageKey = 'zod.errors.invalid_union_discriminator';
      options = {
        options: issue.options.join(', '),
        count: issue.options.length,
      };
      break;

    case z.ZodIssueCode.invalid_enum_value:
      messageKey = 'zod.errors.invalid_enum_value';
      options = {
        options: issue.options.join(', '),
        received: issue.received,
      };
      break;

    case z.ZodIssueCode.invalid_arguments:
      messageKey = 'zod.errors.invalid_arguments';
      break;

    case z.ZodIssueCode.invalid_return_type:
      messageKey = 'zod.errors.invalid_return_type';
      break;

    case z.ZodIssueCode.invalid_date:
      messageKey = 'zod.errors.invalid_date';
      break;

    case z.ZodIssueCode.invalid_string:
      // Handle object-based validations (startsWith, endsWith)
      if (typeof issue.validation === 'object') {
        if ('startsWith' in issue.validation) {
          messageKey = 'zod.errors.invalid_string.startsWith';
          options = { startsWith: issue.validation.startsWith };
        } else if ('endsWith' in issue.validation) {
          messageKey = 'zod.errors.invalid_string.endsWith';
          options = { endsWith: issue.validation.endsWith };
        } else {
          messageKey = 'zod.errors.custom';
        }
      } else {
        messageKey = `zod.errors.invalid_string.${issue.validation}`;
        options = {
          validation: translateLabel(issue.validation, {
            prefix: 'validations',
          }),
        };
      }
      break;

    case z.ZodIssueCode.too_small: {
      // Build nested key: too_small.{type}.{exact|inclusive|not_inclusive}
      const type = issue.type || 'string';
      let variant;
      if (issue.exact) {
        variant = 'exact';
      } else {
        variant = issue.inclusive ? 'inclusive' : 'not_inclusive';
      }
      messageKey = `zod.errors.too_small.${type}.${variant}`;
      options = { minimum: issue.minimum, count: issue.minimum };
      break;
    }

    case z.ZodIssueCode.too_big: {
      // Build nested key: too_big.{type}.{exact|inclusive|not_inclusive}
      const type = issue.type || 'string';
      let variant;
      if (issue.exact) {
        variant = 'exact';
      } else {
        variant = issue.inclusive ? 'inclusive' : 'not_inclusive';
      }
      messageKey = `zod.errors.too_big.${type}.${variant}`;
      options = { maximum: issue.maximum, count: issue.maximum };
      break;
    }

    case z.ZodIssueCode.custom:
      // Support custom i18n keys via params.i18n
      if (issue.params && issue.params.i18n) {
        if (typeof issue.params.i18n === 'string') {
          messageKey = issue.params.i18n;
        } else if (
          typeof issue.params.i18n === 'object' &&
          issue.params.i18n.key
        ) {
          messageKey = issue.params.i18n.key;
          options = issue.params.i18n.options || {};
        } else {
          messageKey = 'zod.errors.custom';
        }
      } else {
        messageKey = 'zod.errors.custom';
      }
      break;

    case z.ZodIssueCode.invalid_intersection_types:
      messageKey = 'zod.errors.invalid_intersection_types';
      break;

    case z.ZodIssueCode.not_multiple_of:
      messageKey = 'zod.errors.not_multiple_of';
      options = { multipleOf: issue.multipleOf };
      break;

    case z.ZodIssueCode.not_finite:
      messageKey = 'zod.errors.not_finite';
      break;

    default:
      return { message: ctx.defaultError };
  }

  // Add path context for field-specific messages (supports WithPath pattern)
  options.path = issue.path ? issue.path.join('.') : '';

  // Try to get message with path suffix first (e.g., invalidTypeWithPath)
  if (options.path) {
    const withPathKey = messageKey + 'WithPath';
    const withPathMessage = t(withPathKey, {
      ...options,
      defaultValue: null,
    });
    if (withPathMessage && withPathMessage !== withPathKey) {
      return { message: withPathMessage };
    }
  }

  return { message: t(messageKey, options) };
});

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
