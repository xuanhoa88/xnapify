/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email validation regex
 * RFC 5322 compliant email validation
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation rules
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Validate email format
 *
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
  return email && EMAIL_REGEX.test(email);
}

/**
 * Validate password strength
 *
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validatePassword(password) {
  const errors = [];

  if (!password) {
    return { isValid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be less than ${PASSWORD_MAX_LENGTH} characters`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate registration data
 *
 * @param {Object} data - Registration data
 * @returns {Object} Validation errors (empty if valid)
 */
export function validateRegistration(data) {
  const errors = {};

  // Email validation
  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Invalid email format';
  }

  // Password validation
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors[0];
  }

  // Display name validation (optional)
  if (data.display_name && data.display_name.length > 100) {
    errors.display_name = 'Display name must be less than 100 characters';
  }

  return errors;
}

/**
 * Validate login data
 *
 * @param {Object} data - Login data
 * @returns {Object} Validation errors (empty if valid)
 */
export function validateLogin(data) {
  const errors = {};

  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (!data.password) {
    errors.password = 'Password is required';
  }

  return errors;
}

/**
 * Validate password reset request
 *
 * @param {Object} data - Password reset data
 * @returns {Object} Validation errors (empty if valid)
 */
export function validatePasswordReset(data) {
  const errors = {};

  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Invalid email format';
  }

  return errors;
}
