/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo, useState, useEffect } from 'react';
import { registry } from './registry';

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
 *   const extendedSchema = usePluginValidator('profile.schema', baseSchema, z);
 *
 * @param {string} schemaId - Schema identifier
 * @param {ZodSchema} baseSchema - Base Zod schema object
 * @param {Object} validator - Zod instance (caller provides)
 */
export function usePluginValidator(schemaId, baseSchema, validator) {
  return useMemo(
    () => registry.extendValidator(schemaId, baseSchema, validator),
    [schemaId, baseSchema, validator],
  );
}

/**
 * Hook to fetch default values from plugins
 *
 * Usage:
 *   const { defaults, loading } = usePluginDefaults('profile.defaults', user);
 *
 * @param {string} hookId - Hook identifier
 * @param {any} context - Context to pass to the hook
 */
export function usePluginDefaultValues(hookId, context) {
  const [defaults, setDefaults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadDefaults = async () => {
      try {
        const results = await registry.executeHook(hookId, context);
        if (mounted) {
          // Merge all results into a single object (last plugin wins)
          const merged = Object.assign({}, ...results);
          setDefaults(merged);
        }
      } catch (error) {
        console.error(
          `[usePluginDefaults] Error loading defaults for ${hookId}:`,
          error,
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (context) {
      loadDefaults();
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [hookId, context]);

  return [defaults, loading];
}
