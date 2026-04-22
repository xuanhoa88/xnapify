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

import useMask from './useMask';

/**
 * FormInputMask - Masked input element to be used inside Form.Field baked by Radix Themes
 *
 * Supports mask patterns:
 *   9 — digit (0-9)
 *   a — letter (A-Z, a-z)
 *   * — alphanumeric (A-Z, a-z, 0-9)
 *   s — lowercase alphanumeric and hyphen (a-z, 0-9, -)
 *   \ — escape the next character
 *
 * Usage:
 *   <Form.Field name="phone" label="Phone">
 *     <Form.InputMask mask="+1 (999) 999-9999" />
 *   </Form.Field>
 */
const FormInputMask = forwardRef(function FormInputMask$(
  {
    type = 'text',
    size = '3',
    placeholder: userPlaceholder,
    className,
    disabled,
    autoFocus,
    mask,
    maskPlaceholder,
    onChange: customOnChange,
    ...props
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { register } = useFormContext();

  const {
    ref: registerRef,
    onChange: rhfOnChange,
    onBlur: rhfOnBlur,
    ...registerProps
  } = register(name);

  const { maskHandlers, placeholder: maskPlaceholderText } = useMask({
    mask,
    maskPlaceholder,
  });

  // Merge refs — both react-hook-form ref and forwarded ref
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  // Use composeEventHandlers to safely chain mask, custom, and RHF handlers
  const handleChange = composeEventHandlers(
    customOnChange,
    composeEventHandlers(maskHandlers.onChange, rhfOnChange),
  );
  const handleBlur = composeEventHandlers(
    props.onBlur,
    composeEventHandlers(maskHandlers.onBlur, rhfOnBlur),
  );
  const handleFocus = composeEventHandlers(props.onFocus, maskHandlers.onFocus);
  const handleKeyDown = composeEventHandlers(
    props.onKeyDown,
    maskHandlers.onKeyDown,
  );

  return (
    <TextField.Root
      id={id}
      type={type}
      size={size}
      placeholder={userPlaceholder || maskPlaceholderText}
      disabled={disabled}
      color={error ? 'red' : undefined}
      className={className}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      {...registerProps}
      {...props}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      ref={handleRef}
    />
  );
});

FormInputMask.propTypes = {
  /** Input type */
  type: PropTypes.string,
  /** Mask pattern string (e.g. "999-999-9999") */
  mask: PropTypes.string.isRequired,
  /** Character to display for unfilled positions (default: "_") */
  maskPlaceholder: PropTypes.string,
  /** Placeholder text (overrides auto-generated mask placeholder) */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Radix size */
  size: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Auto focus on mount */
  autoFocus: PropTypes.bool,
  /** Custom onChange handler */
  onChange: PropTypes.func,
  /** Custom onBlur handler */
  onBlur: PropTypes.func,
  /** Custom onFocus handler */
  onFocus: PropTypes.func,
  /** Custom onKeyDown handler */
  onKeyDown: PropTypes.func,
};

export default FormInputMask;
