/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormField } from '../FormContext';
import s from './FormCheckbox.css';

/**
 * FormCheckbox - Checkbox element to be used inside Form.Field
 *
 * Usage:
 *   <Form.Field name="rememberMe">
 *     <Form.Checkbox label="Remember me" />
 *   </Form.Field>
 */
const FormCheckbox = forwardRef(function FormCheckbox$(
  { label, className, disabled, ...props },
  forwardedRef,
) {
  const { id, name } = useFormField();
  const { register } = useFormContext();

  // Get registration props including ref
  const { ref: registerRef, ...registerProps } = register(name);

  // Merge refs - both react-hook-form ref and forwarded ref
  const handleRef = useCallback(
    element => {
      registerRef(element);
      if (typeof forwardedRef === 'function') {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    },
    [registerRef, forwardedRef],
  );

  return (
    <label className={clsx(s.checkboxLabel, className)} htmlFor={id}>
      <input
        id={id}
        type='checkbox'
        disabled={disabled}
        className={s.checkbox}
        {...registerProps}
        {...props}
        ref={handleRef}
      />
      <span className={s.checkboxText}>{label}</span>
    </label>
  );
});

FormCheckbox.propTypes = {
  /** Checkbox label */
  label: PropTypes.node,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
};

export default FormCheckbox;
