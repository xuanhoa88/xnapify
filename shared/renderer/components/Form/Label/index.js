/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import {
  useFormField,
  useFormValidation,
  isFieldRequired,
} from '../FormContext';

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
  // Safely handle cases where FormValidationContext is not provided (e.g., in extensions)
  const { schema, z } = useFormValidation();
  const { i18n } = useTranslation();

  const resolvedSchema = useMemo(() => {
    if (typeof schema === 'function') {
      try {
        return schema({ i18n, z });
      } catch (error) {
        console.warn('Failed to resolve schema for label:', error);
        return null;
      }
    }
    return schema;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, i18n, i18n.language]);

  // Auto-detect required from schema, allow override via prop
  const required = requiredProp || isFieldRequired(resolvedSchema, name);

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
