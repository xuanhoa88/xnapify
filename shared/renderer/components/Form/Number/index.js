/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { TextField, IconButton, Flex } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import {
  useFormField,
  useMergeRefs,
  composeEventHandlers,
} from '../FormContext';

import s from './Index.css';

/**
 * FormNumberInput - Number input with +/- buttons baked by Radix Themes
 *
 * Usage:
 *   <Form.Field name="quantity" label="Quantity">
 *     <Form.Number min={1} max={100} step={1} />
 *   </Form.Field>
 */
const FormNumberInput = forwardRef(function FormNumberInput$(
  {
    placeholder,
    size = '3',
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

  const formValue = watch(name);
  const numericValue =
    formValue === '' || formValue == null || Number.isNaN(formValue)
      ? min
      : Number(formValue);

  // Get registration props including ref
  const {
    ref: registerRef,
    onChange,
    onBlur,
    ...registerProps
  } = register(name, {
    valueAsNumber: true,
  });

  // Merge refs
  const handleRef = useMergeRefs(registerRef, forwardedRef);

  const increment = () => {
    const newValue = numericValue + step;
    if (max === undefined || newValue <= max) {
      setValue(name, newValue, { shouldDirty: true, shouldValidate: true });
    }
  };

  const decrement = () => {
    const newValue = numericValue - step;
    if (newValue >= min) {
      setValue(name, newValue, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <Flex align='center' gap='2' className={className}>
      <IconButton
        type='button'
        variant='soft'
        color='gray'
        onClick={decrement}
        disabled={disabled || numericValue <= min}
        aria-label='Decrease'
        tabIndex={-1}
      >
        −
      </IconButton>
      <TextField.Root
        id={id}
        type='number'
        size={size}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        color={error ? 'red' : undefined}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        className={s.numberInput}
        {...registerProps}
        {...props}
        onChange={composeEventHandlers(props.onChange, onChange)}
        onBlur={composeEventHandlers(props.onBlur, onBlur)}
        ref={handleRef}
      />
      <IconButton
        type='button'
        variant='soft'
        color='gray'
        onClick={increment}
        disabled={disabled || (max != null && numericValue >= max)}
        aria-label='Increase'
        tabIndex={-1}
      >
        +
      </IconButton>
    </Flex>
  );
});

FormNumberInput.propTypes = {
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Radix size */
  size: PropTypes.string,
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
  /** Custom onChange handler */
  onChange: PropTypes.func,
  /** Custom onBlur handler */
  onBlur: PropTypes.func,
};

export default FormNumberInput;
