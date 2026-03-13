/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useContext, useMemo } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { FormFieldContext } from '../FormContext';

import s from './FormError.css';

// Find the first nested error with a message
const findMessage = errObj => {
  if (!errObj || typeof errObj !== 'object') return null;
  if (typeof errObj.message === 'string') return errObj.message;
  for (const key in errObj) {
    if (Object.prototype.hasOwnProperty.call(errObj, key)) {
      const msg = findMessage(errObj[key]);
      if (msg) return msg;
    }
  }
  return null;
};

/**
 * FormError - Displays field errors and async validation status
 *
 * Renders a single line below the field with the following priority:
 *   1. Error message (sync or async)
 *   2. "⏳ Validating…" while async validation is in progress
 *   3. "✓" when async validation passes
 *   4. Nothing when idle
 *
 * Also supports form-level errors via explicit `message` prop.
 */
function FormError({ message, className }) {
  const { t } = useTranslation();

  const fieldContext = useContext(FormFieldContext);
  const error = fieldContext && fieldContext.error;
  const { isValidating, validationStatus, asyncMessages } = fieldContext || {};

  // Determine what to display: { text, css, role } or null
  const display = useMemo(() => {
    const msgs = asyncMessages || {};

    // --- Explicit message prop (form-level) ---
    if (message) {
      const msgText =
        typeof message === 'string'
          ? message
          : message.message || findMessage(message);
      return { text: msgText, css: s.formError, role: 'alert' };
    }

    // --- Field-level error (sync or async) ---
    if (error) {
      const errorMsg =
        typeof error.message === 'string' ? error.message : findMessage(error);
      if (errorMsg) {
        return { text: errorMsg, css: s.fieldError, role: 'alert' };
      }
    }

    // --- Async validation in progress ---
    if (isValidating) {
      return {
        text:
          msgs.validating ||
          t('zod:form.messages.validating', '⏳ Validating…'),
        css: s.fieldStatus,
        role: 'status',
      };
    }

    // --- Async validation passed ---
    if (validationStatus === 'valid') {
      return msgs.valid
        ? {
            text: msgs.valid,
            css: s.fieldValid,
            role: 'status',
          }
        : null;
    }

    return null;
  }, [message, error, isValidating, validationStatus, asyncMessages, t]);

  if (!display) return null;

  return (
    <div
      className={clsx(display.css, className)}
      role={display.role}
      aria-live={display.role === 'status' ? 'polite' : undefined}
    >
      {display.text}
    </div>
  );
}

FormError.propTypes = {
  /** Error message (optional - auto-detected from Form.Field context) */
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  /** Additional CSS class names */
  className: PropTypes.string,
};

export default FormError;
