/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import { useFormField } from '../FormContext';

import s from './FormRadio.css';

/**
 * FormRadio - Radio group element to be used inside Form.Field
 *
 * Usage:
 *   <Form.Field name="gender" label="Gender">
 *     <Form.Radio options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
 *   </Form.Field>
 */
function FormRadio({
  options = [],
  className,
  disabled,
  direction = 'vertical',
  ...props
}) {
  const { id, name } = useFormField();
  const { register } = useFormContext();

  // Get registration props (ref is handled per-option for radio buttons)
  const { ref: registerRef, ...registerProps } = register(name);

  return (
    <div
      className={clsx(
        s.radioGroup,
        {
          [s.horizontal]: direction === 'horizontal',
        },
        className,
      )}
      role='radiogroup'
    >
      {options.map((option, index) => {
        const optionId = `${id}-${index}`;
        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className={clsx(s.radioLabel, {
              [s.disabled]: disabled || option.disabled,
            })}
          >
            <input
              id={optionId}
              type='radio'
              value={option.value}
              disabled={disabled || option.disabled}
              className={s.radio}
              {...registerProps}
              {...props}
              ref={registerRef}
            />
            <span className={s.radioIndicator} />
            <span className={s.radioText}>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

FormRadio.propTypes = {
  /** Options array with { value, label, disabled? } objects */
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    }),
  ),
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state for all options */
  disabled: PropTypes.bool,
  /** Layout direction: 'vertical' or 'horizontal' */
  direction: PropTypes.oneOf(['vertical', 'horizontal']),
};

export default FormRadio;
