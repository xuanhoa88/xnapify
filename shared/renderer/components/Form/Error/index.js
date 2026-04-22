/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useContext, useMemo } from 'react';

import { Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { FormFieldContext } from '../FormContext';

// Max recursion depth to prevent stack overflow on circular or deeply nested objects
const MAX_DEPTH = 5;

// Find the first nested error with a message
const findMessage = (errObj, depth = 0) => {
  if (!errObj || typeof errObj !== 'object' || depth > MAX_DEPTH) return null;
  if (typeof errObj.message === 'string') return errObj.message;
  const keys = Object.keys(errObj);
  for (let i = 0; i < keys.length; i++) {
    const msg = findMessage(errObj[keys[i]], depth + 1);
    if (msg) return msg;
  }
  return null;
};

/**
 * FormError - Displays field errors and async validation status baked by Radix Themes Text
 *
 * Renders a single line below the field with the following priority:
 *   1. Error message (sync or async)
 *   2. "⏳ Validating…" while async validation is in progress
 *   3. "✓" when async validation passes
 *   4. Nothing when idle
 *
 * Can be used in two modes:
 *   - **Inside Form.Field**: auto-reads errors from field context (no props needed)
 *   - **Standalone**: pass an explicit `message` prop for form-level errors
 */
function FormError({ message, className }) {
  const { t } = useTranslation();

  // Safely read field context — null when used standalone (form-level errors)
  const fieldContext = useContext(FormFieldContext);
  const error = fieldContext && fieldContext.error;
  const { isValidating, validationStatus, asyncMessages } = fieldContext || {};

  // Pre-resolve translated strings so `t` is not a useMemo dependency
  const defaultValidatingMsg = t(
    'zod:form.messages.validating',
    '⏳ Validating…',
  );

  // Determine what to display: { text, color, role } or null
  const display = useMemo(() => {
    const msgs = asyncMessages || {};

    // --- Explicit message prop (form-level) ---
    if (message != null && message !== '') {
      const msgText =
        typeof message === 'string'
          ? message
          : message.message || findMessage(message);
      return msgText ? { text: msgText, color: 'red', role: 'alert' } : null;
    }

    // --- Field-level error (sync or async) ---
    if (error) {
      const errorMsg =
        typeof error.message === 'string' ? error.message : findMessage(error);
      if (errorMsg) {
        return { text: errorMsg, color: 'red', role: 'alert' };
      }
    }

    // --- Async validation in progress ---
    if (isValidating) {
      return {
        text: msgs.validating || defaultValidatingMsg,
        color: 'gray',
        role: 'status',
      };
    }

    // --- Async validation passed ---
    if (validationStatus === 'valid') {
      return msgs.valid
        ? {
            text: msgs.valid,
            color: 'green',
            role: 'status',
          }
        : null;
    }

    return null;
  }, [
    message,
    error,
    isValidating,
    validationStatus,
    asyncMessages,
    defaultValidatingMsg,
  ]);

  if (!display) return null;

  return (
    <Text
      as='div'
      size='2'
      color={display.color}
      weight='medium'
      mt='1'
      role={display.role}
      aria-live={display.role === 'status' ? 'polite' : undefined}
      className={className}
    >
      {display.text}
    </Text>
  );
}

FormError.propTypes = {
  /** Error message (optional - auto-detected from Form.Field context) */
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  /** Additional CSS class names */
  className: PropTypes.string,
};

export default FormError;
