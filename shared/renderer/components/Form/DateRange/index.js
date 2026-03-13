/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useMemo } from 'react';

import Cleave from 'cleave.js/react';
import clsx from 'clsx';
import get from 'lodash/get';
import PropTypes from 'prop-types';
import { useFormContext, useController } from 'react-hook-form';

import { useFormField } from '../FormContext';

import s from './FormDateRange.css';

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
 * FormDateRange - Date Range input element to be used inside Form.Field
 *
 * Automatically detects whether the format contains time tokens
 * and switches between Cleave's date mode and blocks mode.
 *
 * Default behavior:
 * registers `name[0]` (start) and `name[1]` (end) in the form,
 * producing an array value: [startDate, endDate].
 *
 * Usage:
 *   <Form.Field name="period" label="Period">
 *     <Form.DateRange />
 *   </Form.Field>
 *
 *   <Form.Field name="period" label="Period">
 *     <Form.DateRange format="DD/MM/YYYY HH:mm" />
 *   </Form.Field>
 */
const FormDateRange = forwardRef(function FormDateRange$(
  {
    className,
    disabled,
    autoFocus,
    format = 'DD/MM/YYYY',
    startPlaceholder,
    endPlaceholder,
    ...props
  },
  forwardedRef,
) {
  const { id, name } = useFormField();
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const startName = `${name}[0]`;
  const endName = `${name}[1]`;

  const startError = get(errors, startName);
  const endError = get(errors, endName);

  // Build Cleave options based on whether time tokens are present
  const options = useMemo(() => {
    if (TIME_TOKENS.test(format)) {
      return {
        blocks: parseBlocks(format),
        delimiters: parseDelimiters(format),
        numericOnly: true,
      };
    }
    return { date: true, datePattern: parseDatePattern(format) };
  }, [format]);

  const { field: startField } = useController({ name: startName, control });
  const { field: endField } = useController({ name: endName, control });

  return (
    <div className={clsx(s.container, className)} ref={forwardedRef}>
      <Cleave
        id={`${id}-start`}
        options={options}
        disabled={disabled}
        className={clsx(s.input, { [s.inputError]: startError })}
        placeholder={startPlaceholder || format}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        onChange={startField.onChange}
        onBlur={startField.onBlur}
        value={startField.value || ''}
        name={startField.name}
        {...props}
        htmlRef={startField.ref}
      />
      <span className={s.separator}>→</span>
      <Cleave
        id={`${id}-end`}
        options={options}
        disabled={disabled}
        className={clsx(s.input, { [s.inputError]: endError })}
        placeholder={endPlaceholder || format}
        onChange={endField.onChange}
        onBlur={endField.onBlur}
        value={endField.value || ''}
        name={endField.name}
        {...props}
        htmlRef={endField.ref}
      />
    </div>
  );
});

FormDateRange.propTypes = {
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Auto focus on mount */
  autoFocus: PropTypes.bool,
  /** Format string (e.g. 'DD/MM/YYYY' or 'DD/MM/YYYY HH:mm') */
  format: PropTypes.string,
  /** Start placeholder */
  startPlaceholder: PropTypes.string,
  /** End placeholder */
  endPlaceholder: PropTypes.string,
};

export default FormDateRange;
