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

import { AppContext } from '../../AppContext';

/**
 * Hook to execute extension hooks
 *
 * Usage:
 *   const hooks = useExtensionHooks();
 *   await hooks.execute('profile.submit', formData);
 */
export function useExtensionHooks() {
  const { container } = useContext(AppContext);
  const { registry } = container.resolve('extension');

  return useMemo(
    () => ({
      execute: (hookId, ...args) => registry.executeHook(hookId, ...args),
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
  const { container } = useContext(AppContext);
  const { registry } = container.resolve('extension');

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
  }, [hookId, registry]); // Only re-run when hookId or registry changes

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
  const { container } = useContext(AppContext);
  const { registry } = container.resolve('extension');

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
  }, [hookId, context, registry]); // Re-run when hookId, context, or registry changes

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
  const { container } = useContext(AppContext);
  const { registry } = container.resolve('extension');

  const [components, setComponents] = useState(() =>
    registry.getSlotEntries(name),
  );

  const sync = useCallback(() => {
    setComponents(registry.getSlotEntries(name));
  }, [name, registry]);

  useEffect(() => {
    sync();
    return registry.subscribe(sync);
  }, [sync, registry]);

  return components;
}
