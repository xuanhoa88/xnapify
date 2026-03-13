/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useState } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import { useFormField, useMergeRefs } from '../FormContext';

import s from './FormPasswordInput.css';

/**
 * FormPasswordInput - Password input with show/hide toggle
 *
 * Usage:
 *   <Form.Field name="password" label="Password">
 *     <Form.Password placeholder="Enter your password" />
 *   </Form.Field>
 */
const FormPasswordInput = forwardRef(function FormPasswordInput$(
  { placeholder = '••••••••', className, disabled, autoFocus, ...props },
  forwardedRef,
) {
  const [showPassword, setShowPassword] = useState(false);
  const { id, name, error } = useFormField();
  const { register } = useFormContext();

  // Get registration props including ref
  const { ref: registerRef, ...registerProps } = register(name);

  // Merge refs - both react-hook-form ref and forwarded ref
  // Merge refs - both react-hook-form ref and forwarded ref
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className={s.passwordWrapper}>
      <input
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(s.input, { [s.inputError]: error }, className)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        {...registerProps}
        {...props}
        type={showPassword ? 'text' : 'password'}
        ref={handleRef}
      />
      <button
        type='button'
        className={s.toggleButton}
        onClick={togglePasswordVisibility}
        disabled={disabled}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? (
          <svg
            className={s.icon}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
            <line x1='1' y1='1' x2='23' y2='23' />
          </svg>
        ) : (
          <svg
            className={s.icon}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
            <circle cx='12' cy='12' r='3' />
          </svg>
        )}
      </button>
    </div>
  );
});

FormPasswordInput.propTypes = {
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Auto focus on mount */
  autoFocus: PropTypes.bool,
};

export default FormPasswordInput;
