/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { Flex, RadioGroup, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useController, useFormContext } from 'react-hook-form';

import { useFormField, useMergeRefs, useComposedHandler } from '../FormContext';

/**
 * FormRadio - Radio group element to be used inside Form.Field baked by Radix Themes
 *
 * Usage:
 *   <Form.Field name="gender" label="Gender">
 *     <Form.Radio options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
 *   </Form.Field>
 */
const FormRadio = forwardRef(function FormRadio$(
  {
    options = [],
    size = '2',
    className,
    disabled,
    direction = 'vertical',
    ...props
  },
  forwardedRef,
) {
  const { name, error } = useFormField();
  const { control } = useFormContext();

  const { field } = useController({ name, control });
  const handleRef = useMergeRefs(field.ref, forwardedRef);
  const handleValueChange = useComposedHandler(
    props.onValueChange,
    field.onChange,
  );
  const handleBlur = useComposedHandler(props.onBlur, field.onBlur);

  return (
    <RadioGroup.Root
      value={field.value !== undefined ? String(field.value) : undefined}
      disabled={disabled}
      name={field.name}
      size={size}
      color={error ? 'red' : undefined}
      className={className}
      {...props}
      onValueChange={handleValueChange}
      onBlur={handleBlur}
      ref={handleRef}
    >
      <Flex gap='3' direction={direction === 'horizontal' ? 'row' : 'column'}>
        {options.map(option => (
          <Text as='label' size={size} key={option.value}>
            <Flex gap='2' align='center'>
              <RadioGroup.Item
                value={String(option.value)}
                disabled={disabled || option.disabled}
              />
              {option.label}
            </Flex>
          </Text>
        ))}
      </Flex>
    </RadioGroup.Root>
  );
});

FormRadio.propTypes = {
  /** Options array with { value, label, disabled? } objects */
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.node.isRequired,
      disabled: PropTypes.bool,
    }),
  ),
  /** Radix size */
  size: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state for all options */
  disabled: PropTypes.bool,
  /** Layout direction: 'vertical' or 'horizontal' */
  direction: PropTypes.oneOf(['vertical', 'horizontal']),
  /** Custom onValueChange handler */
  onValueChange: PropTypes.func,
  /** Custom onBlur handler */
  onBlur: PropTypes.func,
};

export default FormRadio;
