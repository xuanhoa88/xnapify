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
import s from './FormTextarea.css';

/**
 * FormTextarea - Simple textarea element to be used inside Form.Field
 *
 * Usage:
 *   <Form.Field name="bio" label="Bio">
 *     <Form.Textarea placeholder="Tell us about yourself" rows={4} />
 *   </Form.Field>
 */
const FormTextarea = forwardRef(function FormTextarea$(
  { placeholder, className, disabled, rows = 4, ...props },
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
    <textarea
      id={id}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={clsx(s.textarea, { [s.textareaError]: error }, className)}
      {...registerProps}
      {...props}
      ref={handleRef}
    />
  );
});

FormTextarea.propTypes = {
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Number of visible rows */
  rows: PropTypes.number,
};

export default FormTextarea;
