/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/takeUntil';

/**
 * useInfiniteScroll - Custom hook for infinite scroll using RxJS
 *
 * SSR-compatible hook that listens to scroll events on a container
 * and triggers a callback when the user scrolls near the bottom.
 *
 * @param {Object} options - Configuration options
 * @param {React.RefObject} options.containerRef - Ref to the scrollable container
 * @param {Function} options.onLoadMore - Callback to trigger when near bottom
 * @param {boolean} options.hasMore - Whether there's more data to load
 * @param {boolean} options.loading - Whether data is currently loading
 * @param {number} options.threshold - Pixels from bottom to trigger (default: 100)
 * @param {number} options.debounce - Debounce time in ms (default: 150)
 *
 * @example
 * const containerRef = useRef(null);
 *
 * useInfiniteScroll({
 *   containerRef,
 *   onLoadMore: handleLoadMore,
 *   hasMore,
 *   loading: loadingMore,
 *   threshold: 50,
 * });
 *
 * return (
 *   <div ref={containerRef} style={{ overflow: 'auto', maxHeight: 300 }}>
 *     {items.map(item => <Item key={item.id} {...item} />)}
 *   </div>
 * );
 */
export function useInfiniteScroll({
  containerRef,
  onLoadMore,
  hasMore,
  loading,
  threshold = 100,
  debounce = 150,
}) {
  const destroy$ = useRef(null);

  // Store latest values in refs to avoid stale closures
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(loading);
  const onLoadMoreRef = useRef(onLoadMore);

  // Update refs when values change
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    // SSR guard - only run on client
    if (typeof window === 'undefined') return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    // Create a subject to manage cleanup
    destroy$.current = new Subject();

    // Create scroll observable (RxJS v5 uses method chaining)
    const scroll$ = Observable.fromEvent(container, 'scroll')
      .takeUntil(destroy$.current)
      .debounceTime(debounce)
      .filter(() => {
        // Check if we should load more
        if (!hasMoreRef.current || loadingRef.current) {
          return false;
        }

        // Calculate if we're near the bottom
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        return distanceFromBottom <= threshold;
      });

    // Subscribe to scroll events
    const subscription = scroll$.subscribe(() => {
      if (onLoadMoreRef.current) {
        onLoadMoreRef.current();
      }
    });

    return () => {
      // Cleanup
      if (destroy$.current) {
        destroy$.current.next();
        destroy$.current.complete();
      }
      subscription.unsubscribe();
    };
  }, [containerRef, threshold, debounce]);
}

/**
 * useDebounce - Custom hook for debouncing a value using RxJS
 *
 * SSR-compatible hook that debounces value changes.
 *
 * @param {*} value - The value to debounce
 * @param {number} delay - Debounce delay in ms (default: 300)
 * @param {Function} callback - Callback to trigger with debounced value
 *
 * @example
 * const [search, setSearch] = useState('');
 *
 * useDebounce(search, 300, (debouncedSearch) => {
 *   loadData(1, debouncedSearch, true);
 * });
 */
export function useDebounce(value, delay = 300, callback) {
  const subject$ = useRef(null);
  const destroy$ = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Initialize subject
  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return undefined;

    subject$.current = new Subject();
    destroy$.current = new Subject();

    // RxJS v5 uses method chaining
    const subscription = subject$.current
      .takeUntil(destroy$.current)
      .debounceTime(delay)
      .subscribe(debouncedValue => {
        if (callbackRef.current) {
          callbackRef.current(debouncedValue);
        }
      });

    return () => {
      if (destroy$.current) {
        destroy$.current.next();
        destroy$.current.complete();
      }
      subscription.unsubscribe();
    };
  }, [delay]);

  // Push value changes to subject
  useEffect(() => {
    if (subject$.current) {
      subject$.current.next(value);
    }
  }, [value]);
}

/**
 * Creates a memoized callback that won't cause infinite loops
 */
export function useStableCallback(callback) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args) =>
      typeof callbackRef.current === 'function' && callbackRef.current(...args),
    [],
  );
}

export default useInfiniteScroll;
