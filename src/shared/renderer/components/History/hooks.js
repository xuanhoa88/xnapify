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
import { HistoryContext } from '../../Providers/History';

/** @type {{ matched: false, params: {} }} Reusable no-match sentinel */
const NO_MATCH = Object.freeze({ matched: false, params: {} });

/**
 * Hook to access history instance from context
 * @returns {Object} History instance
 * @throws {Error} If used outside of HistoryProvider
 */
export function useHistory() {
  const history = useContext(HistoryContext);
  if (!history) {
    throw __DEV__
      ? Object.assign(
          new Error('useHistory must be used within a HistoryProvider'),
          { name: 'HistoryContextError' },
        )
      : new Error('HistoryContextError');
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
      push: history.push.bind(history),
      replace: history.replace.bind(history),
      go: history.go.bind(history),
      back: history.back.bind(history),
      forward: history.forward.bind(history),
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
 * Supports static segments, named params (:id), and trailing wildcards (*)
 * @param {string} pattern - Route pattern (e.g., '/users/:id', '/admin/*')
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
export function useMatch(pattern) {
  const pathname = usePathname();

  return useMemo(() => {
    const patternSegs = pattern.split('/').filter(Boolean);
    const pathSegs = pathname.split('/').filter(Boolean);
    const params = {};

    const hasWildcard =
      patternSegs.length > 0 && patternSegs[patternSegs.length - 1] === '*';
    const segsToMatch = hasWildcard ? patternSegs.slice(0, -1) : patternSegs;

    if (!hasWildcard && segsToMatch.length !== pathSegs.length) return NO_MATCH;
    if (hasWildcard && pathSegs.length < segsToMatch.length) return NO_MATCH;

    for (let i = 0; i < segsToMatch.length; i++) {
      const seg = segsToMatch[i];
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(pathSegs[i]);
      } else if (seg !== pathSegs[i]) {
        return NO_MATCH;
      }
    }

    return { matched: true, params };
  }, [pathname, pattern]);
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
 * Builds a URL from a pattern, query params, and options.
 * Pure utility — no React hooks needed.
 * @param {string} pattern - URL pattern with optional :param placeholders
 * @param {Object} [options={}] - Additional options
 * @param {Object} [options.params={}] - Route param values to substitute
 * @param {Object} [options.query={}] - Query params as key-value pairs (arrays supported)
 * @param {string} [options.hash=''] - URL hash fragment
 * @returns {string} Built URL
 * @example
 * buildUrl('/users/:id/posts', { params: { id: 123 }, query: { page: 2 }, hash: 'section-2' });
 * // '/users/123/posts?page=2#section-2'
 */
export function buildUrl(pattern, options = {}) {
  try {
    const { params = {}, query = {}, hash = '' } = options;

    // Substitute route params
    const pathname =
      Object.keys(params).length > 0
        ? pattern.replace(/:([^/]+)/g, (_, key) =>
            encodeURIComponent(params[key] != null ? params[key] : ''),
          )
        : pattern;

    // Build query string
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else {
        searchParams.set(key, String(value));
      }
    });

    const search = searchParams.toString();
    const hashStr = hash ? `#${hash.replace(/^#/, '')}` : '';

    return `${pathname}${search.length > 0 ? `?${search}` : ''}${hashStr}`;
  } catch (error) {
    console.error('Error building URL:', error);
    return pattern;
  }
}
