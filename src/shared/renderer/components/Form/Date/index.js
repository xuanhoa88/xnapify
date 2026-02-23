/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useMemo } from 'react';
import { useFormContext, useController } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import Cleave from 'cleave.js/react';
import { useFormField, useMergeRefs } from '../FormContext';
import s from './FormDate.css';

/** Time-related tokens that distinguish a datetime format from a date-only format */
const TIME_TOKENS = /[Hhms]/;

/**
 * Parse a date-only format string into a Cleave datePattern array.
 * e.g. 'DD/MM/YYYY' -> ['d', 'm', 'Y']
 */
function parseDatePattern(formatStr) {
  return formatStr
    .split(/[^a-zA-Z]+/)
    .map(token => {
      const t = token.toUpperCase();
      if (t.includes('Y')) return t.length >= 4 ? 'Y' : 'y';
      if (t.includes('M')) return 'm';
      if (t.includes('D')) return 'd';
      return null;
    })
    .filter(Boolean);
}

/**
 * Extract numeric block sizes from a format string.
 * e.g. 'DD/MM/YYYY HH:mm' -> [2, 2, 4, 2, 2]
 */
function parseBlocks(formatStr) {
  const tokens = formatStr.match(/[a-zA-Z]+/g) || [];
  return tokens.map(token => token.length);
}

/**
 * Extract delimiter strings from a format string.
 * e.g. 'DD/MM/YYYY HH:mm' -> ['/', '/', ' ', ':']
 */
function parseDelimiters(formatStr) {
  return formatStr.match(/[^a-zA-Z]+/g) || [];
}

/**
 * FormDate - Masked Date / DateTime input element to be used inside Form.Field
 *
 * Automatically detects whether the format contains time tokens
 * and switches between Cleave's date mode and blocks mode.
 *
 * Usage:
 *   <Form.Field name="birthdate" label="Birth Date">
 *     <Form.Date />
 *   </Form.Field>
 *
 *   <Form.Field name="eventStart" label="Event Start">
 *     <Form.Date format="DD/MM/YYYY HH:mm" />
 *   </Form.Field>
 */
const FormDate = forwardRef(function FormDate$(
  {
    className,
    disabled,
    autoFocus,
    format = 'DD/MM/YYYY',
    placeholder,
    ...props
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { control } = useFormContext();
  const { field } = useController({ name, control });

  // Merge refs - both react-hook-form ref and forwarded ref
  const handleRef = useMergeRefs(field.ref, forwardedRef);

  // Build Cleave options based on whether time tokens are present
  const options = useMemo(() => {
    if (TIME_TOKENS.test(format)) {
      // DateTime mode: use blocks + delimiters
      return {
        blocks: parseBlocks(format),
        delimiters: parseDelimiters(format),
        numericOnly: true,
      };
    }
    // Date-only mode: use Cleave's native date option
    return { date: true, datePattern: parseDatePattern(format) };
  }, [format]);

  return (
    <Cleave
      id={id}
      options={options}
      disabled={disabled}
      className={clsx(s.input, { [s.inputError]: error }, className)}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      placeholder={placeholder || format}
      onChange={field.onChange}
      onBlur={field.onBlur}
      value={field.value || ''}
      name={field.name}
      {...props}
      htmlRef={handleRef}
    />
  );
});

FormDate.propTypes = {
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Auto focus on mount */
  autoFocus: PropTypes.bool,
  /** Date format string (e.g. 'DD/MM/YYYY' or 'DD/MM/YYYY HH:mm') */
  format: PropTypes.string,
  /** Placeholder text */
  placeholder: PropTypes.string,
};

export default FormDate;
