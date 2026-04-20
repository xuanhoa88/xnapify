/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { TextArea } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import { useFormField, useMergeRefs } from '../FormContext';

import s from './Textarea.css';

/**
 * FormTextarea - Simple textarea element to be used inside Form.Field backed by Radix Themes
 *
 * Usage:
 *   <Form.Field name="bio" label="Bio">
 *     <Form.Textarea placeholder="Tell us about yourself" rows={4} />
 *   </Form.Field>
 */
const FormTextarea = forwardRef(function FormTextarea$(
  { placeholder, size = '3', className, disabled, rows = 4, ...props },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { register } = useFormContext();

  // Get registration props including ref
  const { ref: registerRef, ...registerProps } = register(name);

  // Merge refs - both react-hook-form ref and forwarded ref
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  return (
    <TextArea
      id={id}
      size={size}
      placeholder={placeholder}
      disabled={disabled}
      color={error ? 'red' : undefined}
      rows={rows}
      className={clsx(className, s.root)}
      {...registerProps}
      {...props}
      ref={handleRef}
    />
  );
});

FormTextarea.propTypes = {
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Radix size */
  size: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Number of visible rows */
  rows: PropTypes.number,
};

export default FormTextarea;
