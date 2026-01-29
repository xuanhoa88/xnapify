/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import registry from './registry';

/**
 * Hook to execute plugin hooks
 *
 * Usage:
 *   const hooks = usePluginHooks();
 *   await hooks.execute('profile.submit', formData);
 */
export function usePluginHooks() {
  return useMemo(
    () => ({
      execute: (hookId, ...args) => registry.executeHook(hookId, ...args),
    }),
    [],
  );
}

/**
 * Hook to extend a Zod schema with plugin-registered extenders
 *
 * Usage:
 *   const extendedSchema = usePluginSchema('profile.schema', baseSchema, z);
 *
 * @param {string} schemaId - Schema identifier
 * @param {ZodSchema} baseSchema - Base Zod schema object
 * @param {Object} validator - Zod instance (caller provides)
 */
export function usePluginSchema(schemaId, baseSchema, validator) {
  return useMemo(
    () => registry.extendSchema(schemaId, baseSchema, validator),
    [schemaId, baseSchema, validator],
  );
}
