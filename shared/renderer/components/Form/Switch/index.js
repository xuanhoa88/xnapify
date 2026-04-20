/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { Switch, Flex, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

import { useFormField } from '../FormContext';

import s from './Switch.css';

/**
 * FormSwitch - Toggle switch backed by Radix Themes
 *
 * Usage:
 *   <Form.Field name="notifications">
 *     <Form.Switch label="Enable notifications" />
 *   </Form.Field>
 */
const FormSwitch = forwardRef(function FormSwitch$(
  { label, size = '2', className, disabled, ...props },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Text as='label' size={size}>
          <Flex gap='2' align='center' className={className}>
            <Switch
              id={id}
              size={size}
              disabled={disabled}
              className={s.root}
              checked={field.value || false}
              color={error ? 'red' : undefined}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              ref={ref => {
                field.ref(ref);
                if (typeof forwardedRef === 'function') forwardedRef(ref);
                else if (forwardedRef) forwardedRef.current = ref;
              }}
              {...props}
            />
            {label}
          </Flex>
        </Text>
      )}
    />
  );
});

FormSwitch.propTypes = {
  /** Switch label */
  label: PropTypes.node,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Radix size (1, 2, 3) */
  size: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
};

export default FormSwitch;
