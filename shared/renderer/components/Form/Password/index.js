/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useState } from 'react';

import { EyeOpenIcon, EyeNoneIcon } from '@radix-ui/react-icons';
import { TextField, IconButton } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import { useFormField, useMergeRefs } from '../FormContext';

import s from './Index.css';

/**
 * FormPasswordInput - Password input with show/hide toggle baked by Radix Themes
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
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <TextField.Root
      id={id}
      type={showPassword ? 'text' : 'password'}
      placeholder={placeholder}
      disabled={disabled}
      color={error ? 'red' : undefined}
      className={className}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      {...registerProps}
      {...props}
      ref={handleRef}
    >
      <TextField.Slot side='right' px='1'>
        <IconButton
          size='1'
          variant='ghost'
          color='gray'
          onClick={togglePasswordVisibility}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOpenIcon width='14' height='14' className={s.passwordIcon} />
          ) : (
            <EyeNoneIcon width='14' height='14' className={s.passwordIcon} />
          )}
        </IconButton>
      </TextField.Slot>
    </TextField.Root>
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
