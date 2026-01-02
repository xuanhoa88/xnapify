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
import s from './FormInput.css';

/**
 * FormInput - Simple input element to be used inside Form.Field
 *
 * Usage:
 *   <Form.Field name="email" label="Email">
 *     <Form.Input type="email" placeholder="Enter your email" />
 *   </Form.Field>
 */
const FormInput = forwardRef(function FormInput$(
  { type = 'text', placeholder, className, disabled, autoFocus, ...props },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
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
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      className={clsx(s.input, { [s.inputError]: error }, className)}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      {...registerProps}
      {...props}
      ref={handleRef}
    />
  );
});

FormInput.propTypes = {
  /** Input type */
  type: PropTypes.string,
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Auto focus on mount */
  autoFocus: PropTypes.bool,
};

export default FormInput;
