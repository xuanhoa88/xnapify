/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { Select } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

import { useFormField } from '../FormContext';

import s from './Select.css';

/**
 * FormSelect - Select element to be used inside Form.Field baked by Radix Themes
 *
 * Usage:
 *   <Form.Field name="role" label="Role">
 *     <Form.Select options={[{ value: 'admin', label: 'Admin' }]} placeholder="Select a role" />
 *   </Form.Field>
 */
const FormSelect = forwardRef(function FormSelect$(
  { options = [], placeholder, size = '2', className, disabled, ...props },
  forwardedRef,
) {
  const { name, error } = useFormField();
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select.Root
          size={size}
          value={field.value !== undefined ? String(field.value) : undefined}
          onValueChange={field.onChange}
          disabled={disabled}
        >
          <Select.Trigger
            placeholder={placeholder}
            color={error ? 'red' : undefined}
            className={clsx(className, s.root)}
            ref={ref => {
              field.ref(ref);
              if (typeof forwardedRef === 'function') forwardedRef(ref);
              else if (forwardedRef) forwardedRef.current = ref;
            }}
            {...props}
          />
          <Select.Content>
            {options.map(option => (
              <Select.Item key={option.value} value={String(option.value)}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      )}
    />
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
  /** Radix size */
  size: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
};

export default FormSelect;
