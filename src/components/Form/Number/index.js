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
import s from './FormNumberInput.css';

/**
 * FormNumberInput - Number input with +/- buttons
 *
 * Usage:
 *   <Form.Field name="quantity" label="Quantity">
 *     <Form.Number min={1} max={100} step={1} />
 *   </Form.Field>
 */
const FormNumberInput = forwardRef(function FormNumberInput$(
  {
    placeholder,
    className,
    disabled,
    min = 0,
    max,
    step = 1,
    autoFocus,
    ...props
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { register, setValue, watch } = useFormContext();

  const currentValue = watch(name) || min;

  // Get registration props including ref
  const { ref: registerRef, ...registerProps } = register(name, {
    valueAsNumber: true,
  });

  // Merge refs
  // Merge refs
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  const increment = () => {
    const newValue = Number(currentValue) + step;
    if (max === undefined || newValue <= max) {
      setValue(name, newValue);
    }
  };

  const decrement = () => {
    const newValue = Number(currentValue) - step;
    if (newValue >= min) {
      setValue(name, newValue);
    }
  };

  return (
    <div className={clsx(s.numberWrapper, { [s.error]: error }, className)}>
      <button
        type='button'
        className={s.button}
        onClick={decrement}
        disabled={disabled || Number(currentValue) <= min}
        aria-label='Decrease'
        tabIndex={-1}
      >
        −
      </button>
      <input
        id={id}
        type='number'
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={clsx(s.input, { [s.inputError]: error })}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        {...registerProps}
        {...props}
        ref={handleRef}
      />
      <button
        type='button'
        className={s.button}
        onClick={increment}
        disabled={
          disabled || (max !== undefined && Number(currentValue) >= max)
        }
        aria-label='Increase'
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
});

FormNumberInput.propTypes = {
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Minimum value */
  min: PropTypes.number,
  /** Maximum value */
  max: PropTypes.number,
  /** Step increment */
  step: PropTypes.number,
  /** Auto focus on mount */
  autoFocus: PropTypes.bool,
};

export default FormNumberInput;
