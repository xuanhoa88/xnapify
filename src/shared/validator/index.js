/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import i18n from '../i18n/getInstance';
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
 * @param {string} [options.prefix] - Prefix namespace for the translation key
 * @returns {string} Translated value or original value if translation not found
 */
function translateLabel(value, options = {}) {
  const { prefix } = options;

  if (!prefix) {
    return value;
  }

  const key = `zod:${prefix}.${value}`;
  const translated = i18n.t(key, { defaultValue: value });

  // Return original value if translation key wasn't found
  return translated !== key ? translated : value;
}

/**
 * Handle invalid_string validation messages
 * @private
 */
function handleInvalidString(issue, translateLabel) {
  // Handle object-based validations (startsWith, endsWith)
  if (typeof issue.validation === 'object') {
    if ('startsWith' in issue.validation) {
      return {
        key: 'zod:errors.invalid_string.startsWith',
        options: { startsWith: issue.validation.startsWith },
      };
    }

    if ('endsWith' in issue.validation) {
      return {
        key: 'zod:errors.invalid_string.endsWith',
        options: { endsWith: issue.validation.endsWith },
      };
    }

    // Unknown object validation
    return {
      key: 'zod:errors.custom',
      options: {},
    };
  }

  // String-based validations (email, url, uuid, etc.)
  return {
    key: `zod:errors.invalid_string.${issue.validation}`,
    options: {
      validation: translateLabel(issue.validation, { prefix: 'validations' }),
    },
  };
}

/**
 * Handle too_small validation messages
 * @private
 */
function handleTooSmall(issue) {
  const type = issue.type || 'string';
  const variant = issue.exact
    ? 'exact'
    : issue.inclusive
      ? 'inclusive'
      : 'not_inclusive';

  return {
    key: `zod:errors.too_small.${type}.${variant}`,
    options: {
      minimum: issue.minimum,
      count: issue.minimum,
    },
  };
}

/**
 * Handle too_big validation messages
 * @private
 */
function handleTooBig(issue) {
  const type = issue.type || 'string';
  const variant = issue.exact
    ? 'exact'
    : issue.inclusive
      ? 'inclusive'
      : 'not_inclusive';

  return {
    key: `zod:errors.too_big.${type}.${variant}`,
    options: {
      maximum: issue.maximum,
      count: issue.maximum,
    },
  };
}

/**
 * Handle custom validation messages with i18n support
 * @private
 */
function handleCustom(issue) {
  // Support custom i18n keys via params.i18n
  if (!issue.params || !issue.params.i18n) {
    return {
      key: 'zod:errors.custom',
      options: {},
    };
  }

  const { i18n: i18nParam } = issue.params;

  // String format: params.i18n = "custom.error.key"
  if (typeof i18nParam === 'string') {
    return {
      key: i18nParam,
      options: {},
    };
  }

  // Object format: params.i18n = { key: "custom.error.key", options: { ... } }
  if (typeof i18nParam === 'object' && i18nParam.key) {
    return {
      key: i18nParam.key,
      options: i18nParam.options || {},
    };
  }

  // Invalid format, fallback to default
  return {
    key: 'zod:errors.custom',
    options: {},
  };
}

/**
 * Get message key and options for a given Zod issue
 * @private
 */
function getMessageKeyAndOptions(issue) {
  let messageKey;
  let options = {};

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      // Handle undefined/null as required field errors
      if (issue.received === 'undefined') {
        messageKey = 'zod:errors.invalid_type_received_undefined';
      } else if (issue.received === 'null') {
        messageKey = 'zod:errors.invalid_type_received_null';
      } else {
        messageKey = 'zod:errors.invalid_type';
        options = {
          expected: translateLabel(issue.expected, { prefix: 'types' }),
          received: translateLabel(issue.received, { prefix: 'types' }),
        };
      }
      break;

    case z.ZodIssueCode.invalid_literal:
      messageKey = 'zod:errors.invalid_literal';
      options = { expected: JSON.stringify(issue.expected) };
      break;

    case z.ZodIssueCode.unrecognized_keys:
      messageKey = 'zod:errors.unrecognized_keys';
      options = {
        keys: issue.keys.join(', '),
        count: issue.keys.length,
      };
      break;

    case z.ZodIssueCode.invalid_union:
      messageKey = 'zod:errors.invalid_union';
      break;

    case z.ZodIssueCode.invalid_union_discriminator:
      messageKey = 'zod:errors.invalid_union_discriminator';
      options = {
        options: issue.options.join(', '),
        count: issue.options.length,
      };
      break;

    case z.ZodIssueCode.invalid_enum_value:
      messageKey = 'zod:errors.invalid_enum_value';
      options = {
        options: issue.options.join(', '),
        received: issue.received,
      };
      break;

    case z.ZodIssueCode.invalid_arguments:
      messageKey = 'zod:errors.invalid_arguments';
      break;

    case z.ZodIssueCode.invalid_return_type:
      messageKey = 'zod:errors.invalid_return_type';
      break;

    case z.ZodIssueCode.invalid_date:
      messageKey = 'zod:errors.invalid_date';
      break;

    case z.ZodIssueCode.invalid_string: {
      const result = handleInvalidString(issue, translateLabel);
      messageKey = result.key;
      options = result.options;
      break;
    }

    case z.ZodIssueCode.too_small: {
      const result = handleTooSmall(issue);
      messageKey = result.key;
      options = result.options;
      break;
    }

    case z.ZodIssueCode.too_big: {
      const result = handleTooBig(issue);
      messageKey = result.key;
      options = result.options;
      break;
    }

    case z.ZodIssueCode.custom: {
      const result = handleCustom(issue);
      messageKey = result.key;
      options = result.options;
      break;
    }

    case z.ZodIssueCode.invalid_intersection_types:
      messageKey = 'zod:errors.invalid_intersection_types';
      break;

    case z.ZodIssueCode.not_multiple_of:
      messageKey = 'zod:errors.not_multiple_of';
      options = { multipleOf: issue.multipleOf };
      break;

    case z.ZodIssueCode.not_finite:
      messageKey = 'zod:errors.not_finite';
      break;

    default:
      return null; // Signal to use default error
  }

  return { messageKey, options };
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
  const result = getMessageKeyAndOptions(issue);

  // Use default error if issue code not handled
  if (!result) {
    return { message: ctx.defaultError };
  }

  const { messageKey, options } = result;

  // Add path context for field-specific messages (supports WithPath pattern)
  const path = issue.path && issue.path.length > 0 ? issue.path.join('.') : '';
  const optionsWithPath = { ...options, path };

  // Try to get message with path suffix first (e.g., invalidTypeWithPath)
  if (path) {
    const withPathKey = `${messageKey}WithPath`;
    if (i18n.exists(withPathKey)) {
      return { message: i18n.t(withPathKey, optionsWithPath) };
    }
  }

  return { message: i18n.t(messageKey, optionsWithPath) };
});

/**
 * Validate form data and return errors array (empty if valid)
 *
 * @param {Function} schema - Factory function that receives { i18n, z } and returns Zod schema
 * @param {Object} data - Form data to validate
 * @returns {[boolean, Object|undefined]} - Tuple [isValid, errors]. errors is undefined if valid.
 *
 * @example
 * const [isValid, errors] = validateForm(loginFormSchema, { email, password });
 * if (!isValid) {
 *   return res.status(422).json({
 *     success: false,
 *     message: 'Validation failed',
 *     errors,
 *   });
 * }
 */
export function validateForm(schema, data) {
  // Validate inputs
  if (typeof schema !== 'function') {
    return [
      false,
      {
        _schema: [
          'Invalid schema: expected a function that returns a Zod schema',
        ],
      },
    ];
  }

  let zodSchema;

  // Call schema factory and handle any errors
  try {
    zodSchema = schema({ i18n, z });
  } catch (error) {
    // Schema factory threw an error - return in same format as validation errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return [
      false,
      {
        _schema: [`Schema initialization failed: ${errorMessage}`],
      },
    ];
  }

  // Validate that we got a valid Zod schema with safeParse method
  if (!zodSchema || typeof zodSchema.safeParse !== 'function') {
    return [
      false,
      {
        _schema: [
          'Invalid schema: schema factory must return a Zod schema object with safeParse method',
        ],
      },
    ];
  }

  // Validate data using safeParse (never throws)
  const result = zodSchema.safeParse(data);

  if (result.success) {
    return [true, result.data];
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
