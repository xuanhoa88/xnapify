/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import { match as matchPath, compile as compilePath } from 'path-to-regexp';
import { HistoryContext } from '../../shared/renderer/Providers';

/**
 * Hook to access history instance from context
 * @returns {Object} History instance
 * @throws {Error} If used outside of HistoryProvider
 */
export function useHistory() {
  const history = useContext(HistoryContext);
  if (!history) {
    const error = new Error('useHistory must be used within a HistoryProvider');
    error.name = 'HistoryContextError';
    throw error;
  }
  return history;
}

/**
 * Hook to get current location from history
 * @returns {Object} Current location object { pathname, search, hash, state, key }
 */
export function useLocation() {
  return useHistory().location;
}

/**
 * Hook to get current pathname from history
 * @returns {string} Current pathname
 */
export function usePathname() {
  return useLocation().pathname;
}

/**
 * Hook to get current search params as object
 * @returns {Object} Search params as key-value object
 * @example
 * // URL: /page?foo=bar&baz=qux
 * const search = useSearch(); // { foo: 'bar', baz: 'qux' }
 */
export function useSearch() {
  const { search } = useLocation();
  return useMemo(
    () => Object.fromEntries(new URLSearchParams(search)),
    [search],
  );
}

/**
 * Hook to get search param value(s) by key
 * Auto-detects single vs multiple values
 * @param {string} key - The search param key to retrieve
 * @returns {string|string[]|null} Single value, array if multiple, or null if not found
 * @example
 * // URL: /page?foo=bar
 * const foo = useQuery('foo'); // 'bar'
 *
 * // URL: /page?tag=js&tag=react
 * const tags = useQuery('tag'); // ['js', 'react']
 *
 * // URL: /page
 * const missing = useQuery('missing'); // null
 */
export function useQuery(key) {
  const { search } = useLocation();

  return useMemo(() => {
    const values = new URLSearchParams(search).getAll(key);
    if (values.length === 0) return null;
    if (values.length === 1) return values[0];
    return values;
  }, [search, key]);
}

/**
 * Hook to get current hash from location
 * @returns {string} Current hash (including #)
 * @example
 * // URL: /page#section-1
 * const hash = useHash(); // '#section-1'
 */
export function useHash() {
  return useLocation().hash;
}

/**
 * Hook to get current location state
 * @returns {any} Current location state
 */
export function useLocationState() {
  return useLocation().state;
}

/**
 * Hook to get navigation functions
 * @returns {Object} { push, replace, go, back, forward }
 */
export function useNavigate() {
  const history = useHistory();
  return useMemo(
    () => ({
      push: (path, state) => history.push(path, state),
      replace: (path, state) => history.replace(path, state),
      go: n => history.go(n),
      back: () => history.back(),
      forward: () => history.forward(),
    }),
    [history],
  );
}

/**
 * Hook to update query params without losing existing ones
 * @returns {Function} Function to update query params
 * @example
 * const setQuery = useSetQuery();
 * setQuery({ page: '2', sort: 'name' }); // Merges with existing params
 * setQuery({ page: null }); // Removes 'page' param
 * setQuery({ filter: 'active' }, { replace: true }); // Replace instead of push
 */
export function useSetQuery() {
  const history = useHistory();
  const { pathname, search, hash, state } = useLocation();

  return useCallback(
    (updates, options = {}) => {
      const { replace = false } = options || {};
      const currentParams = new URLSearchParams(search);

      // Update or remove params
      Object.entries(updates).forEach(([key, value]) => {
        if (value == null) {
          currentParams.delete(key);
        } else {
          currentParams.set(key, value);
        }
      });

      const newSearch = currentParams.toString();
      const newUrl = `${pathname}${newSearch ? `?${newSearch}` : ''}${hash}`;

      if (replace) {
        history.replace(newUrl, state);
      } else {
        history.push(newUrl, state);
      }
    },
    [history, pathname, search, hash, state],
  );
}

/**
 * Hook to check if a pathname matches a route pattern
 * Uses path-to-regexp for pattern matching with param extraction
 * @param {string} pattern - Route pattern (e.g., '/users/:id', '/admin/*')
 * @param {Object} [options] - Options for path-to-regexp match()
 * @returns {{ matched: boolean, params: Object }} Match result and extracted params
 * @example
 * // URL: /users/123
 * const { matched, params } = useMatch('/users/:id');
 * // matched: true, params: { id: '123' }
 *
 * // URL: /admin/settings/security
 * const { matched } = useMatch('/admin/*');
 * // matched: true
 *
 * // URL: /about
 * const { matched } = useMatch('/users/:id');
 * // matched: false, params: {}
 */
export function useMatch(pattern, options = {}) {
  const pathname = usePathname();

  return useMemo(() => {
    const matcher = matchPath(pattern, {
      decode: decodeURIComponent,
      ...options,
    });
    const result = matcher(pathname);

    if (result) {
      return { matched: true, params: result.params || {} };
    }
    return { matched: false, params: {} };
  }, [pathname, pattern, options]);
}

/**
 * Hook to listen to location changes
 * @param {Function} callback - Callback function called on location change
 * @example
 * useLocationChange((location, action) => {
 *   console.log('Navigated to:', location.pathname);
 * });
 */
export function useLocationChange(callback) {
  const history = useHistory();

  useEffect(() => history.listen(callback), [history, callback]);
}

/**
 * Hook to get previous location (tracks previous after each change)
 * @returns {Object|null} Previous location or null on first render
 */
export function usePreviousLocation() {
  const location = useLocation();
  const prevRef = useRef(null);
  const [prevLocation, setPrevLocation] = useState(null);

  useEffect(() => {
    // Store previous before updating
    setPrevLocation(prevRef.current);
    prevRef.current = location;
  }, [location]);

  return prevLocation;
}

/**
 * Hook to build URLs with route params and query params
 * Uses path-to-regexp compile for route param substitution
 * @returns {Function} Function to build URLs
 * @example
 * const buildUrl = useBuildUrl();
 *
 * // Simple query params
 * buildUrl('/products', { category: 'electronics' });
 * // '/products?category=electronics'
 *
 * // Route params (path-to-regexp syntax)
 * buildUrl('/users/:id', {}, { params: { id: 123 } });
 * // '/users/123'
 *
 * // Combined route params + query
 * buildUrl('/users/:id/posts', { page: 2 }, { params: { id: 123 } });
 * // '/users/123/posts?page=2'
 *
 * // Array values
 * buildUrl('/search', { tag: ['js', 'react'] });
 * // '/search?tag=js&tag=react'
 *
 * // With hash
 * buildUrl('/docs', { section: 'api' }, { hash: 'installation' });
 * // '/docs?section=api#installation'
 */
export function useBuildUrl() {
  return useCallback((pattern, query = {}, options = {}) => {
    const { params = {}, hash = '' } = options || {};

    // Compile route params if any
    let pathname = pattern;
    if (Object.keys(params).length > 0) {
      const toPath = compilePath(pattern, { encode: encodeURIComponent });
      pathname = toPath(params);
    }

    // Build query string
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value == null) return;

      // Handle arrays
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else {
        searchParams.set(key, String(value));
      }
    });

    const search = searchParams.toString();
    const hashStr = hash ? `#${hash.replace(/^#/, '')}` : '';

    return `${pathname}${search.length > 0 ? `?${search}` : ''}${hashStr}`;
  }, []);
}
