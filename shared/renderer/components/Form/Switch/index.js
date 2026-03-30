/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import { useFormField, useMergeRefs } from '../FormContext';

import s from './FormSwitch.css';

/**
 * FormSwitch - Toggle switch (modern alternative to checkbox)
 *
 * Usage:
 *   <Form.Field name="notifications">
 *     <Form.Switch label="Enable notifications" />
 *   </Form.Field>
 */
const FormSwitch = forwardRef(function FormSwitch$(
  { label, className, disabled, ...props },
  forwardedRef,
) {
  const { id, name } = useFormField();
  const { register } = useFormContext();

  // Get registration props including ref
  const { ref: registerRef, ...registerProps } = register(name);

  // Merge refs
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  return (
    <label className={clsx(s.switchWrapper, className)} htmlFor={id}>
      <input
        id={id}
        type='checkbox'
        disabled={disabled}
        className={s.input}
        {...registerProps}
        {...props}
        ref={handleRef}
      />
      <span className={s.slider} />
      {label && <span className={s.label}>{label}</span>}
    </label>
  );
});

FormSwitch.propTypes = {
  /** Switch label */
  label: PropTypes.node,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
};

export default FormSwitch;
