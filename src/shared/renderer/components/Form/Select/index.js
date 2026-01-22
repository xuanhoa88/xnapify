/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';
import { useFormContext } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormField, useMergeRefs } from '../FormContext';
import s from './FormSelect.css';

/**
 * FormSelect - Simple select element to be used inside Form.Field
 *
 * Usage:
 *   <Form.Field name="role" label="Role">
 *     <Form.Select options={[{ value: 'admin', label: 'Admin' }]} placeholder="Select a role" />
 *   </Form.Field>
 */
const FormSelect = forwardRef(function FormSelect$(
  { options = [], placeholder, className, disabled, ...props },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { register } = useFormContext();

  // Get registration props including ref
  const { ref: registerRef, ...registerProps } = register(name);

  // Merge refs - both react-hook-form ref and forwarded ref
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  return (
    <div className={s.selectWrapper}>
      <select
        id={id}
        disabled={disabled}
        className={clsx(s.select, { [s.selectError]: error }, className)}
        {...registerProps}
        {...props}
        ref={handleRef}
      >
        {placeholder && (
          <option value='' disabled>
            {placeholder}
          </option>
        )}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className={s.selectIcon}>▼</span>
    </div>
  );
});

FormSelect.propTypes = {
  /** Options array with { value, label } objects */
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  /** Placeholder text (shown as disabled first option) */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
};

export default FormSelect;
