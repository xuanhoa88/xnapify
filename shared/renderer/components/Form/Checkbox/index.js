/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { Checkbox, Flex, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

import { useFormField } from '../FormContext';

/**
 * FormCheckbox - Checkbox element to be used inside Form.Field baked by Radix Themes
 *
 * Usage:
 *   <Form.Field name="rememberMe">
 *     <Form.Checkbox label="Remember me" />
 *   </Form.Field>
 */
const FormCheckbox = forwardRef(function FormCheckbox$(
  { label, className, disabled, ...props },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Text as='label' size='2'>
          <Flex gap='2' align='center' className={className}>
            <Checkbox
              id={id}
              disabled={disabled}
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

FormCheckbox.propTypes = {
  /** Checkbox label */
  label: PropTypes.node,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
};

export default FormCheckbox;
