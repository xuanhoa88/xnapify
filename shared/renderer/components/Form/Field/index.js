/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useId } from 'react';

import { Flex } from '@radix-ui/themes';
import get from 'lodash/get';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';

import FormError from '../Error';
import { FormFieldContext } from '../FormContext';
import FormLabel from '../Label';
import useAsyncValidator from '../useAsyncValidator';

/**
 * FormField - Wrapper for form field with optional label and error message backed by Radix Themes
 *
 * Usage:
 *   <Form.Field name="email" label="Email">
 *     <Form.Input type="email" />
 *   </Form.Field>
 *
 *   // With async validation:
 *   <Form.Field
 *     name="username"
 *     label="Username"
 *     asyncValidate={async (value) => {
 *       const data = await fetch(`/api/check?username=${value}`);
 *       return data.taken ? 'Username is taken' : true;
 *     }}
 *   >
 *     <Form.Input />
 *   </Form.Field>
 */
function FormField({
  name,
  label,
  children,
  className,
  required,
  showError = true,
  asyncValidate,
  debounceMs = 300,
  asyncMessages,
}) {
  // useId generates a stable ID that matches between SSR and client hydration,
  // avoiding the htmlFor mismatch warning caused by lodash/uniqueId's global counter.
  const reactId = useId();
  const id = `field-${name}-${reactId}`;
  const {
    formState: { errors },
  } = useFormContext();

  // Async validation — only active when asyncValidate prop is provided
  const { isValidating, validationStatus } = useAsyncValidator(
    name,
    asyncValidate,
    debounceMs,
  );

  // With mode: 'onChange', errors are automatically cleared when field becomes valid
  // Use custom get to access nested errors (e.g., 'items.0.name')
  // Async errors are also set on this same key by useAsyncValidator
  const error = get(errors, name);

  return (
    <FormFieldContext.Provider
      value={{ id, name, error, isValidating, validationStatus, asyncMessages }}
    >
      <Flex direction='column' gap='1' mb='4' className={className}>
        {label && <FormLabel required={required}>{label}</FormLabel>}
        {children}
        {showError && <FormError />}
      </Flex>
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
  /** Async validation function: (value) => true | string (error message) */
  asyncValidate: PropTypes.func,
  /** Debounce delay in ms for async validation (default: 300) */
  debounceMs: PropTypes.number,
  /** Custom messages for async validation status: { validating, valid } */
  asyncMessages: PropTypes.shape({
    validating: PropTypes.string,
    valid: PropTypes.string,
  }),
};

export default FormField;
