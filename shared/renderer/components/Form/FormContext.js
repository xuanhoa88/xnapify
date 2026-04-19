/* eslint-disable no-underscore-dangle */
/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createContext, useContext, useCallback } from 'react';

// Context for form field state (provided by Form.Field)
export const FormFieldContext = createContext(null);

// Context for schema and validation instance (to detect required fields and provide z)
export const FormValidationContext = createContext(null);

/**
 * Hook to get validation context (schema, z)
 */
export function useFormValidation() {
  const context = useContext(FormValidationContext);
  if (!context) {
    throw new Error('useFormValidation must be used within a Form component');
  }
  return context;
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
 * Traverse Zod schema to find the shape definition for a specific field path
 * Handles nested objects, recursive schemas, and optional/nullable wrappers
 *
 * @param {Object} schema - Zod schema
 * @param {string} path - Field path (e.g., 'user.email' or 'items.0.name')
 * @returns {Object|null} - The Zod schema for the field or null if not found
 */
function getSchemaShape(schema, path) {
  if (!schema || !path) return null;

  // Split path into segments (handle array syntax like 'items[0]' -> 'items.0')
  const segments =
    typeof path === 'string'
      ? path.replace(/\[(\d+)\]/g, '.$1').split('.')
      : [];

  let currentSchema = schema;

  for (const segment of segments) {
    if (!currentSchema) return null;

    // Unwrap effects/refinements/optionals/nullables to get to the underlying shape
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (currentSchema._def && currentSchema._def.schema) {
        // Effects, refinements, nullable, optional wrapped
        currentSchema = currentSchema._def.schema;
      } else if (currentSchema._def && currentSchema._def.innerType) {
        // Some other wrappers
        currentSchema = currentSchema._def.innerType;
      } else {
        break;
      }
    }

    // specific handling for arrays if we were traversing arrays...
    // but typically for "required" check we might be looking at the schema definition
    // For arrays, Zod arrays have 'element' property which is the schema for items
    if (currentSchema._def && currentSchema._def.typeName === 'ZodArray') {
      // If the segment is a number, we are accessing an array element
      if (!Number.isNaN(Number(segment))) {
        currentSchema = currentSchema.element;
        continue;
      }
    }
    /* eslint-enable no-underscore-dangle */

    // Objects
    if (currentSchema.shape) {
      currentSchema = currentSchema.shape[segment];
    } else {
      return null;
    }
  }

  return currentSchema;
}

/**
 * Helper to check if a field is required in zod schema
 */
export function isFieldRequired(schema, fieldName) {
  const fieldSchema = getSchemaShape(schema, fieldName);
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

/**
 * Hook to merge multiple refs into one
 * Useful when you need to forward a ref and also use it locally (e.g. for react-hook-form)
 *
 * @param {...(React.Ref<any>|undefined)} refs - Refs to merge
 * @returns {Function} - Merged ref callback
 */
export function useMergeRefs(...refs) {
  return useCallback(
    element => {
      refs.forEach(ref => {
        if (!ref) return;

        if (typeof ref === 'function') {
          ref(element);
        } else {
          // eslint-disable-next-line no-param-reassign
          ref.current = element;
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs,
  );
}
