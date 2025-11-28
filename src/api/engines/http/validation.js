/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Validation Error
 */
export class FieldValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'FieldValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Validation result
 */
export class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  addError(field, message, value = null) {
    this.errors.push({ field, message, value });
    return this;
  }

  addWarning(field, message, value = null) {
    this.warnings.push({ field, message, value });
    return this;
  }

  get isValid() {
    return this.errors.length === 0;
  }

  get hasWarnings() {
    return this.warnings.length > 0;
  }

  getErrors() {
    return this.errors;
  }

  getWarnings() {
    return this.warnings;
  }

  getErrorsForField(field) {
    return this.errors.filter(error => error.field === field);
  }

  getFirstError() {
    return this.errors.length > 0 ? this.errors[0] : null;
  }
}

/**
 * Basic validators
 */
export const validators = {
  /**
   * Check if value is required (not null, undefined, or empty string)
   */
  required: (value, message = 'This field is required') => {
    if (value == null || value === '') {
      throw new FieldValidationError(message, null, value);
    }
    return value;
  },

  /**
   * Check if value is a string
   */
  string: (value, message = 'Must be a string') => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new FieldValidationError(message, null, value);
    }
    return value;
  },

  /**
   * Check if value is a number
   */
  number: (value, message = 'Must be a number') => {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new FieldValidationError(message, null, value);
    }
    return value;
  },

  /**
   * Check if value is an integer
   */
  integer: (value, message = 'Must be an integer') => {
    if (!Number.isInteger(value)) {
      throw new FieldValidationError(message, null, value);
    }
    return value;
  },

  /**
   * Check if value is a boolean
   */
  boolean: (value, message = 'Must be a boolean') => {
    if (typeof value !== 'boolean') {
      throw new FieldValidationError(message, null, value);
    }
    return value;
  },

  /**
   * Check if value is an array
   */
  array: (value, message = 'Must be an array') => {
    if (!Array.isArray(value)) {
      throw new FieldValidationError(message, null, value);
    }
    return value;
  },

  /**
   * Check if value is an object
   */
  object: (value, message = 'Must be an object') => {
    if (typeof value !== 'object' || value == null || Array.isArray(value)) {
      throw new FieldValidationError(message, null, value);
    }
    return value;
  },

  /**
   * Check string minimum length
   */
  minLength:
    (min, message = null) =>
    value => {
      if (typeof value === 'string' && value.length < min) {
        throw new FieldValidationError(
          message || `Must be at least ${min} characters long`,
          null,
          value,
        );
      }
      return value;
    },

  /**
   * Check string maximum length
   */
  maxLength:
    (max, message = null) =>
    value => {
      if (typeof value === 'string' && value.length > max) {
        throw new FieldValidationError(
          message || `Must be at most ${max} characters long`,
          null,
          value,
        );
      }
      return value;
    },

  /**
   * Check number minimum value
   */
  min:
    (min, message = null) =>
    value => {
      if (typeof value === 'number' && value < min) {
        throw new FieldValidationError(
          message || `Must be at least ${min}`,
          null,
          value,
        );
      }
      return value;
    },

  /**
   * Check number maximum value
   */
  max:
    (max, message = null) =>
    value => {
      if (typeof value === 'number' && value > max) {
        throw new FieldValidationError(
          message || `Must be at most ${max}`,
          null,
          value,
        );
      }
      return value;
    },

  /**
   * Check if value matches pattern
   */
  pattern:
    (regex, message = 'Invalid format') =>
    value => {
      if (typeof value === 'string' && !regex.test(value)) {
        throw new FieldValidationError(message, null, value);
      }
      return value;
    },

  /**
   * Check if value is in allowed list
   */
  enum:
    (allowedValues, message = null) =>
    value => {
      if (!allowedValues.includes(value)) {
        throw new FieldValidationError(
          message || `Must be one of: ${allowedValues.join(', ')}`,
          null,
          value,
        );
      }
      return value;
    },

  /**
   * Check if value is a valid email
   */
  email:
    (message = 'Invalid email format') =>
    value => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value === 'string' && !emailRegex.test(value)) {
        throw new FieldValidationError(message, null, value);
      }
      return value;
    },

  /**
   * Check if value is a valid URL
   */
  url:
    (message = 'Invalid URL format') =>
    value => {
      try {
        new URL(value);
        return value;
      } catch {
        throw new FieldValidationError(message, null, value);
      }
    },

  /**
   * Check if value is a valid UUID
   */
  uuid:
    (message = 'Invalid UUID format') =>
    value => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (typeof value === 'string' && !uuidRegex.test(value)) {
        throw new FieldValidationError(message, null, value);
      }
      return value;
    },

  /**
   * Check if value is a valid date
   */
  date:
    (message = 'Invalid date format') =>
    value => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new FieldValidationError(message, null, value);
      }
      return value;
    },

  /**
   * Check if value is a valid ISO date string
   */
  isoDate:
    (message = 'Invalid ISO date format') =>
    value => {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (typeof value === 'string' && !isoRegex.test(value)) {
        throw new FieldValidationError(message, null, value);
      }
      return value;
    },

  /**
   * Custom validator function
   */
  custom:
    (validatorFn, message = 'Validation failed') =>
    value => {
      if (!validatorFn(value)) {
        throw new FieldValidationError(message, null, value);
      }
      return value;
    },
};

/**
 * Create validation schema
 * @param {Object} schema - Field validation rules
 * @returns {Function} Validation function
 */
export function createSchema(schema) {
  return data => {
    const result = new ValidationResult();
    const validatedData = {};

    Object.entries(schema).forEach(([field, rules]) => {
      const value = data[field];
      let processedValue = value;

      try {
        // Apply validation rules in sequence
        if (Array.isArray(rules)) {
          rules.forEach(rule => {
            processedValue = rule(processedValue);
          });
        } else if (typeof rules === 'function') {
          processedValue = rules(processedValue);
        }

        validatedData[field] = processedValue;
      } catch (error) {
        if (error instanceof FieldValidationError) {
          result.addError(field, error.message, value);
        } else {
          result.addError(field, 'Validation error', value);
        }
      }
    });

    return {
      isValid: result.isValid,
      data: validatedData,
      errors: result.getErrors(),
      warnings: result.getWarnings(),
    };
  };
}

/**
 * Validate single field
 * @param {*} value - Value to validate
 * @param {Array|Function} rules - Validation rules
 * @param {string} field - Field name for error reporting
 * @returns {Object} Validation result
 */
export function validateField(value, rules, field = 'field') {
  const result = new ValidationResult();
  let processedValue = value;

  try {
    if (Array.isArray(rules)) {
      rules.forEach(rule => {
        processedValue = rule(processedValue);
      });
    } else if (typeof rules === 'function') {
      processedValue = rules(processedValue);
    }
  } catch (error) {
    if (error instanceof FieldValidationError) {
      result.addError(field, error.message, value);
    } else {
      result.addError(field, 'Validation error', value);
    }
  }

  return {
    isValid: result.isValid,
    value: processedValue,
    errors: result.getErrors(),
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  /**
   * Pagination schema
   */
  pagination: createSchema({
    page: [validators.number, validators.integer, validators.min(1)],
    limit: [
      validators.number,
      validators.integer,
      validators.min(1),
      validators.max(100),
    ],
  }),

  /**
   * ID parameter schema
   */
  idParam: createSchema({
    id: [validators.required, validators.string],
  }),

  /**
   * Search schema
   */
  search: createSchema({
    q: [validators.string, validators.maxLength(255)],
    sortBy: [validators.string],
    sortOrder: [validators.enum(['asc', 'desc'])],
  }),
};

/**
 * Sanitize input data
 * @param {*} data - Data to sanitize
 * @param {Object} options - Sanitization options
 * @returns {*} Sanitized data
 */
export function sanitize(data, options = {}) {
  const {
    trimStrings = true,
    removeEmptyStrings = false,
    removeNullValues = false,
    maxStringLength = null,
  } = options;

  if (typeof data === 'string') {
    let sanitized = data;

    if (trimStrings) {
      sanitized = sanitized.trim();
    }

    if (removeEmptyStrings && sanitized === '') {
      return null;
    }

    if (maxStringLength && sanitized.length > maxStringLength) {
      sanitized = sanitized.substring(0, maxStringLength);
    }

    return sanitized;
  }

  if (Array.isArray(data)) {
    return data
      .map(item => sanitize(item, options))
      .filter(item => {
        if (removeNullValues && item == null) return false;
        if (removeEmptyStrings && item === '') return false;
        return true;
      });
  }

  if (typeof data === 'object' && data != null) {
    const sanitized = {};

    Object.entries(data).forEach(([key, value]) => {
      const sanitizedValue = sanitize(value, options);

      if (removeNullValues && sanitizedValue == null) return;
      if (removeEmptyStrings && sanitizedValue === '') return;

      sanitized[key] = sanitizedValue;
    });

    return sanitized;
  }

  return data;
}
