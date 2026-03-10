/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import get from 'lodash/get';

/**
 * useAsyncValidator
 *
 * Runs async validation **only after** Zod (sync) validation passes.
 * Uses `trigger(name)` to re-run Zod rather than `clearErrors()`,
 * so Zod errors are never accidentally wiped by the async layer.
 *
 * Flow:
 *   1. Value changes → debounce
 *   2. Check if field has sync errors → if yes, skip async
 *   3. Call asyncValidate(value)
 *   4. On success → trigger(name) to re-apply Zod, set validationStatus='valid'
 *   5. On failure → setError(name, ...), set validationStatus='invalid'
 *
 * @param {string} name          Field name (react-hook-form path)
 * @param {Function|null} asyncValidate  (value) => true | string
 * @param {number}  debounceMs   default 300
 * @returns {{ isValidating: boolean, validationStatus: null|'valid'|'invalid' }}
 */
export default function useAsyncValidator(
  name,
  asyncValidate,
  debounceMs = 300,
) {
  const enabled = typeof asyncValidate === 'function';
  const { control, setError, trigger, formState } = useFormContext();
  const value = useWatch({ control, name });

  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);

  const invocationRef = useRef(0);
  const timerRef = useRef(null);
  const validateRef = useRef(asyncValidate);

  // Always keep ref current
  useEffect(() => {
    validateRef.current = asyncValidate;
  });

  // Reset when the form itself is reset
  const { isSubmitSuccessful, submitCount } = formState;
  useEffect(() => {
    setValidationStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitSuccessful, submitCount]);

  const runValidation = useCallback(
    async (val, invocationId) => {
      setIsValidating(true);
      try {
        // Re-check sync validation right before the async call.
        // If Zod has errors on this field, skip async entirely.
        const syncValid = await trigger(name, { shouldFocus: false });
        if (invocationId !== invocationRef.current) return;
        if (!syncValid) {
          // Zod error still present — don't run async
          setValidationStatus(null);
          setIsValidating(false);
          return;
        }

        const result = await validateRef.current(val);
        if (invocationId !== invocationRef.current) return;

        if (result === true) {
          // Re-run Zod to make sure it still agrees (value may have changed)
          await trigger(name, { shouldFocus: false });
          if (invocationId !== invocationRef.current) return;
          setValidationStatus('valid');
        } else {
          setValidationStatus('invalid');
          setError(name, {
            type: 'async',
            message: typeof result === 'string' ? result : 'Validation failed',
          });
        }
      } catch {
        if (invocationId !== invocationRef.current) return;
        setValidationStatus(null);
        // Re-run Zod to restore its state
        await trigger(name, { shouldFocus: false });
      } finally {
        if (invocationId === invocationRef.current) {
          setIsValidating(false);
        }
      }
    },
    [trigger, setError, name],
  );

  useEffect(() => {
    if (!enabled) return;

    if (value === undefined || value === null || value === '') {
      invocationRef.current += 1;
      setValidationStatus(null);
      setIsValidating(false);
      return;
    }

    // If there are already sync errors, don't bother scheduling async
    const syncError = get(formState.errors, name);
    if (syncError && syncError.type !== 'async') {
      invocationRef.current += 1;
      setValidationStatus(null);
      setIsValidating(false);
      return;
    }

    invocationRef.current += 1;
    const currentInvocation = invocationRef.current;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runValidation(value, currentInvocation);
    }, debounceMs);

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs, enabled, name, runValidation]);

  // Invalidate in-flight requests on unmount
  useEffect(() => {
    return () => {
      invocationRef.current += 1;
      clearTimeout(timerRef.current);
    };
  }, []);

  return { isValidating, validationStatus };
}
