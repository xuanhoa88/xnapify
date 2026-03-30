/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/* -------------------------------------------------------------------------- */
/*                               useInfiniteScroll                             */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} UseInfiniteScrollOptions
 * @property {import('react').RefObject<HTMLElement>} containerRef
 *   Ref to the scrollable container element.
 * @property {Function} onLoadMore
 *   Callback fired when the user scrolls near the bottom.
 * @property {boolean} hasMore
 *   Whether there is more data available to load.
 * @property {boolean} loading
 *   Whether a load operation is currently in progress.
 * @property {number} [threshold=100]
 *   Distance in pixels from the bottom at which loading is triggered.
 * @property {number} [debounce=150]
 *   Debounce delay in milliseconds for scroll handling.
 * @property {boolean} [checkOnMount=true]
 *   Whether to check if load is needed on mount.
 */

/**
 * React hook for implementing infinite scrolling without RxJS.
 *
 * - Native scroll listener
 * - Debounced execution
 * - SSR / Worker safe
 * - Prevents stale closures
 * - Compatible with Node 16+
 *
 * @param {UseInfiniteScrollOptions} options
 */
export function useInfiniteScroll({
  containerRef,
  onLoadMore,
  hasMore,
  loading,
  threshold = 100,
  debounce = 150,
  checkOnMount = true,
}) {
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(loading);
  const onLoadMoreRef = useRef(onLoadMore);
  const timeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  /* ----------------------------- Keep refs fresh ---------------------------- */

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  /* -------------------------- Check scroll position ------------------------- */

  const checkScroll = useCallback(() => {
    if (!isMountedRef.current) return;

    if (!containerRef || !containerRef.current) return;
    const container = containerRef.current;

    if (!hasMoreRef.current || loadingRef.current) return;

    const { scrollTop } = container;
    const { scrollHeight } = container;
    const { clientHeight } = container;

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom <= threshold) {
      try {
        if (onLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
      } catch (error) {
        console.error('Error in onLoadMore callback:', error);
      }
    }
  }, [containerRef, threshold]);

  /* --------------------------- Initial check on mount -------------------------- */

  useEffect(() => {
    if (checkOnMount && typeof window !== 'undefined') {
      // Small delay to ensure initial render is complete
      const timer = setTimeout(checkScroll, 100);
      return () => clearTimeout(timer);
    }
  }, [checkOnMount, checkScroll]);

  /* ------------------------------ Scroll logic ------------------------------ */

  useEffect(() => {
    isMountedRef.current = true;

    // SSR / non-DOM guard
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!containerRef || !containerRef.current) {
      return undefined;
    }

    const container = containerRef.current;

    if (typeof container.addEventListener !== 'function') {
      return undefined;
    }

    /**
     * Scroll event handler (debounced).
     */
    function handleScroll() {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        checkScroll();
      }, debounce);
    }

    // Passive listener improves scroll performance
    container.addEventListener('scroll', handleScroll, { passive: true });

    return function cleanup() {
      isMountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, debounce, checkScroll]);
}

/* -------------------------------------------------------------------------- */
/*                                  useDebounce                                */
/* -------------------------------------------------------------------------- */

/**
 * React hook that debounces a value and invokes a callback.
 *
 * - Native timers only
 * - Works in browser, Node, and workers
 * - Avoids stale callback references
 *
 * @template T
 * @param {T} value
 *   Value to debounce.
 * @param {number} [delay=300]
 *   Debounce delay in milliseconds.
 * @param {Function} [callback]
 *   Optional callback invoked with the debounced value.
 * @returns {T} The debounced value
 */
export function useDebounce(value, delay = 300, callback) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const callbackRef = useRef(callback);
  const timeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  /* ----------------------------- Keep callback fresh ----------------------------- */

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* ------------------------------ Debounce logic ------------------------------ */

  useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      setDebouncedValue(value);

      if (callbackRef.current) {
        try {
          callbackRef.current(value);
        } catch (error) {
          console.error('Error in useDebounce callback:', error);
        }
      }
    }, delay);

    return function cleanup() {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

/* -------------------------------------------------------------------------- */
/*                               useStableCallback                             */
/* -------------------------------------------------------------------------- */

/**
 * Returns a memoized callback whose identity never changes
 * but always calls the latest version of the provided function.
 *
 * Useful for:
 * - Event handlers
 * - Subscriptions
 * - Effects with stable dependencies
 *
 * @param {Function} callback
 * @returns {Function}
 */
export function useStableCallback(callback) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(function (...args) {
    if (callbackRef.current) {
      return callbackRef.current.apply(undefined, args);
    }
  }, []);
}

export default useInfiniteScroll;
