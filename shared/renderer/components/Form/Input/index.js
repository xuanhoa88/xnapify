/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { TextField } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import {
  useFormField,
  useMergeRefs,
  composeEventHandlers,
} from '../FormContext';

/**
 * FormInput - Simple input element to be used inside Form.Field backed by Radix Themes
 *
 * Usage:
 *   <Form.Field name="email" label="Email">
 *     <Form.Input type="email" placeholder="Enter your email" />
 *   </Form.Field>
 */
const FormInput = forwardRef(function FormInput$(
  {
    type = 'text',
    size = '2',
    placeholder,
    className,
    disabled,
    autoFocus,
    ...props
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { register } = useFormContext();

  // Get registration props including ref
  const {
    ref: registerRef,
    onChange,
    onBlur,
    ...registerProps
  } = register(name);

  // Merge refs - both react-hook-form ref and forwarded ref
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  return (
    <TextField.Root
      id={id}
      type={type}
      size={size}
      placeholder={placeholder}
      disabled={disabled}
      color={error ? 'red' : undefined}
      className={className}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      {...registerProps}
      {...props}
      onChange={composeEventHandlers(props.onChange, onChange)}
      onBlur={composeEventHandlers(props.onBlur, onBlur)}
      ref={handleRef}
    />
  );
});

FormInput.propTypes = {
  /** Input type */
  type: PropTypes.string,
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Radix size */
  size: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Auto focus on mount */
  autoFocus: PropTypes.bool,
  /** Custom onChange handler */
  onChange: PropTypes.func,
  /** Custom onBlur handler */
  onBlur: PropTypes.func,
};

export default FormInput;
