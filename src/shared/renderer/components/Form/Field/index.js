/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { FormFieldContext } from '../FormContext';
import FormLabel from '../Label';
import FormError from '../Error';
import s from './FormField.css';

/**
 * Safely access nested object properties
 * @param {Object} obj - The object to query
 * @param {string|Array} path - The path of the property to get
 * @param {*} defaultValue - The value returned for undefined resolved values
 * @returns {*} - The resolved value or the default value
 */
function get(obj, path, defaultValue) {
  // Use == null to check for null or undefined (non-strict equality)
  if (obj == null) return defaultValue;

  let segments;
  if (Array.isArray(path)) {
    segments = path;
  } else if (typeof path === 'string' && path.length > 0) {
    segments = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  } else if (typeof path === 'number') {
    segments = [String(path)];
  } else {
    return defaultValue;
  }

  let result = obj;
  for (const segment of segments) {
    if (result == null) {
      return defaultValue;
    }
    result = result[segment];
  }

  return result === undefined ? defaultValue : result;
}

/**
 * FormField - Wrapper for form field with optional label and error message
 *
 * Usage:
 *   <Form.Field name="email" label="Email">
 *     <Form.Input type="email" />
 *   </Form.Field>
 *
 *   // Or with explicit Form.Label and Form.Error:
 *   <Form.Field name="email" showError={false}>
 *     <Form.Label>Email Address</Form.Label>
 *     <Form.Input type="email" />
 *     <Form.Error />
 *   </Form.Field>
 */
function FormField({
  name,
  label,
  children,
  className,
  required,
  showError = true,
}) {
  const id = useMemo(() => `field-${name}`, [name]);
  const {
    formState: { errors },
  } = useFormContext();

  // With mode: 'onChange', errors are automatically cleared when field becomes valid
  // Use custom get to access nested errors (e.g., 'items.0.name')
  const error = get(errors, name);

  return (
    <FormFieldContext.Provider value={{ id, name, error }}>
      <div className={clsx(s.formGroup, className)}>
        {label && <FormLabel required={required}>{label}</FormLabel>}
        {children}
        {showError && <FormError />}
      </div>
    </FormFieldContext.Provider>
  );
}

FormField.propTypes = {
  /** Field name matching schema */
  name: PropTypes.string.isRequired,
  /** Field label (shorthand) - or use Form.Label as child */
  label: PropTypes.node,
  /** Field content */
  children: PropTypes.node.isRequired,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Override required indicator (auto-detected from schema if not provided) */
  required: PropTypes.bool,
  /** Show error message automatically (default: true) */
  showError: PropTypes.bool,
};

export default FormField;
