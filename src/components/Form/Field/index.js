/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useFormContext } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { FormFieldContext, useUid } from '../FormContext';
import FormLabel from '../Label';
import FormError from '../Error';
import s from './FormField.css';

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
  const id = useUid(name);
  const {
    formState: { errors },
  } = useFormContext();

  // With mode: 'onChange', errors are automatically cleared when field becomes valid
  const error = errors[name];

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
