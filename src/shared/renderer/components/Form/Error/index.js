/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useContext, useMemo } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
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
 * FormError - Displays error message
 *
 * Usage inside Form.Field (auto-detects error from field context):
 *   <Form.Field name="email" showError={false}>
 *     <Form.Input />
 *     <Form.Error />
 *   </Form.Field>
 *
 * Usage for form-level errors (explicit message prop):
 *   <Form.Error message={submitError} />
 */
function FormError({ message, className }) {
  const fieldContext = useContext(FormFieldContext);

  // If inside Form.Field, use field error; otherwise use message prop
  const error = fieldContext && fieldContext.error;

  // Get error message
  const displayMessage = useMemo(() => {
    if (!message && error) {
      if (typeof error.message === 'string') {
        return error.message;
      }
      return findMessage(error);
    }
    return message;
  }, [error, message]);

  // Use different style for form-level vs field-level errors
  const isFieldError = useMemo(
    () => !message && Object.keys(fieldContext || {}).length > 0,
    [message, fieldContext],
  );

  return displayMessage ? (
    <div
      className={clsx(isFieldError ? s.fieldError : s.formError, className)}
      role='alert'
    >
      {displayMessage}
    </div>
  ) : null;
}

FormError.propTypes = {
  /** Error message (optional - auto-detected from Form.Field context) */
  message: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
};

export default FormError;
