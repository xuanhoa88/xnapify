/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createContext, useContext, useMemo } from 'react';

// Context for form field state (provided by Form.Field)
export const FormFieldContext = createContext(null);

// Context for schema (to detect required fields)
export const FormSchemaContext = createContext(null);

/**
 * Hook to generate deterministic IDs for SSR compatibility
 * Uses the field name as the base for the ID to ensure server/client match
 */
export function useUid(name) {
  return useMemo(() => `field-${name}`, [name]);
}

/**
 * Hook to get schema context
 */
export function useFormSchema() {
  return useContext(FormSchemaContext);
}

/**
 * Hook to get field context (id, name, error) from parent Form.Field
 */
export function useFormField() {
  const context = useContext(FormFieldContext);
  if (!context) {
    throw new Error('useFormField must be used within a Form.Field component');
  }
  return context;
}

/**
 * Helper to check if a field is required in zod schema
 */
export function isFieldRequired(schema, fieldName) {
  if (!schema || !schema.shape) return false;

  const fieldSchema = schema.shape[fieldName];
  if (!fieldSchema) return false;

  // Check if the field is optional
  // In zod, optional fields have isOptional() method that returns true
  if (
    typeof fieldSchema.isOptional === 'function' &&
    fieldSchema.isOptional()
  ) {
    return false;
  }

  // Check if it's nullable
  if (
    typeof fieldSchema.isNullable === 'function' &&
    fieldSchema.isNullable()
  ) {
    return false;
  }

  // By default, zod fields are required
  return true;
}
