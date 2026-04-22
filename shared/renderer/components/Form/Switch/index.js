/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { Switch, Flex, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useController, useFormContext } from 'react-hook-form';

import { useFormField, useMergeRefs, useComposedHandler } from '../FormContext';

/**
 * FormSwitch - Toggle switch backed by Radix Themes
 *
 * Usage:
 *   <Form.Field name="notifications">
 *     <Form.Switch label="Enable notifications" />
 *   </Form.Field>
 */
const FormSwitch = forwardRef(function FormSwitch$(
  { label, size = '3', className, disabled, ...props },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { control } = useFormContext();

  const { field } = useController({ name, control });
  const handleRef = useMergeRefs(field.ref, forwardedRef);
  const handleCheckedChange = useComposedHandler(
    props.onCheckedChange,
    field.onChange,
  );
  const handleBlur = useComposedHandler(props.onBlur, field.onBlur);

  return (
    <Text as='label' size={size}>
      <Flex gap='2' align='center' className={className}>
        <Switch
          id={id}
          size={size}
          disabled={disabled}
          checked={field.value || false}
          color={error ? 'red' : undefined}
          {...props}
          onCheckedChange={handleCheckedChange}
          onBlur={handleBlur}
          ref={handleRef}
        />
        {label}
      </Flex>
    </Text>
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
  /** Custom onCheckedChange handler */
  onCheckedChange: PropTypes.func,
  /** Custom onBlur handler */
  onBlur: PropTypes.func,
};

export default FormSwitch;
