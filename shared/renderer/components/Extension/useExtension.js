/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
} from 'react';

import { ExtensionContext } from '../../Providers/Extension';

/**
 * Hook to get extension registry
 */
export function useExtensionRegistry() {
  return useContext(ExtensionContext);
}

/**
 * Hook to execute extension hooks
 *
 * Usage:
 *   const hooks = useExtensionHooks();
 *   await hooks.execute('profile.submit', formData);
 */
export function useExtensionHooks() {
  const registry = useExtensionRegistry();
  return useMemo(
    () => ({
      execute: (hookId, ...args) =>
        registry ? registry.executeHook(hookId, ...args) : undefined,
    }),
    [registry],
  );
}

/**
 * Hook to extend a validator schema with extension-registered extenders
 *
 * Usage:
 *   const [schema, loading] = useExtensionValidator('profile.validator', baseSchema, z);
 *
 * @param {string} hookId - Hook identifier
 * @param {ZodSchema} baseSchema - Base Zod schema object
 * @param {Object} validator - Zod instance (caller provides)
 */
export function useExtensionValidator(hookId, baseSchema, validator) {
  const registry = useExtensionRegistry();
  const [schema, setSchema] = useState(baseSchema);
  const [loading, setLoading] = useState(true);

  // Store latest values in refs to avoid stale closures
  const baseSchemaRef = useRef(baseSchema);
  const validatorRef = useRef(validator);
  baseSchemaRef.current = baseSchema;
  validatorRef.current = validator;

  useEffect(() => {
    let mounted = true;

    const execute = async () => {
      try {
        if (!registry) {
          if (mounted) setLoading(false);
          return;
        }
        const results = await registry.executeHook(
          hookId,
          baseSchemaRef.current,
          validatorRef.current,
        );
        if (mounted) {
          // Chain all extenders: each receives the previous schema
          const extended = results.reduce(
            (acc, result) =>
              result && typeof result === 'object' ? result : acc,
            baseSchemaRef.current,
          );
          setSchema(extended);
          setLoading(false);
        }
      } catch (error) {
        console.error(
          `[useExtensionValidator] Error executing ${hookId}:`,
          error,
        );
        if (mounted) {
          setLoading(false);
        }
      }
    };

    execute();

    return () => {
      mounted = false;
    };
  }, [registry, hookId]); // Only re-run when hookId or registry changes

  return [schema, loading];
}

/**
 * Hook to fetch form data from extensions
 *
 * Usage:
 *   const [formData, loading] = useExtensionFormData('profile.formData', user);
 *
 * @param {string} hookId - Hook identifier
 * @param {any} context - Context to pass to the hook
 */
export function useExtensionFormData(hookId, context) {
  const registry = useExtensionRegistry();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  // Store latest context in ref to avoid stale closures
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    if (!context) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    const execute = async () => {
      try {
        if (!registry) {
          if (mounted) setLoading(false);
          return;
        }
        const results = await registry.executeHook(hookId, contextRef.current);
        if (mounted) {
          // Merge all results into a single object (last extension wins)
          const merged = Object.assign({}, ...results);
          setFormData(merged);
          setLoading(false);
        }
      } catch (error) {
        console.error(
          `[useExtensionFormData] Error executing ${hookId}:`,
          error,
        );
        if (mounted) {
          setLoading(false);
        }
      }
    };

    execute();

    return () => {
      mounted = false;
    };
  }, [registry, hookId, context]); // Re-run when hookId, context, or registry changes

  return [formData, loading];
}

/**
 * Hook to get components registered for a named slot
 *
 * Subscribes to registry updates so the component re-renders
 * when extensions register or unregister slot entries.
 *
 * Usage:
 *   const slots = useExtensionSlots('auth.oauth.buttons');
 *   if (slots.length > 0) { ... }
 *
 * @param {string} name - Slot name
 * @returns {Array} Array of registered slot entries
 */
export function useExtensionSlots(name) {
  const registry = useExtensionRegistry();
  const [components, setComponents] = useState(() =>
    registry ? registry.getSlotEntries(name) : [],
  );

  const sync = useCallback(() => {
    if (registry) {
      setComponents(registry.getSlotEntries(name));
    }
  }, [registry, name]);

  useEffect(() => {
    sync();
    if (registry) {
      return registry.subscribe(sync);
    }
    return undefined;
  }, [registry, sync]);

  return components;
}
