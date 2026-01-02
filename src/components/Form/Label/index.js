/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormField, useFormSchema, isFieldRequired } from '../FormContext';
import s from './FormLabel.css';

/**
 * FormLabel - Label element for form fields
 *
 * Usage:
 *   <Form.Field name="email">
 *     <Form.Label>Email Address</Form.Label>
 *     <Form.Input type="email" />
 *   </Form.Field>
 */
function FormLabel({ children, className, required: requiredProp }) {
  const { id, name } = useFormField();
  const schema = useFormSchema();

  // Auto-detect required from schema, allow override via prop
  const required = requiredProp || isFieldRequired(schema, name);

  return (
    <label className={clsx(s.label, className)} htmlFor={id}>
      {children}
      {required && <span className={clsx(s.required, 'required')}>*</span>}
    </label>
  );
}

FormLabel.propTypes = {
  /** Label content */
  children: PropTypes.node.isRequired,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Override required indicator (auto-detected from schema if not provided) */
  required: PropTypes.bool,
};

export default FormLabel;
