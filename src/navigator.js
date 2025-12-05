/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createBrowserHistory, createMemoryHistory } from 'history';

// =============================================================================
// CONSTANTS
// =============================================================================

const isBrowser = typeof window !== 'undefined';

// =============================================================================
// HISTORY INSTANCE (LAZY INITIALIZATION)
// =============================================================================

/**
 * Browser history instance (lazy-initialized, client-only singleton)
 * @private
 */
let browserHistory = null;

/**
 * Unsubscribe function (lazy-initialized)
 * @private
 */
let unsubscribe = null;

/**
 * Initialize history instance
 * Creates browser history in browser, memory history on server
 * For SSR, always creates a fresh memory history to avoid state leaks
 *
 * @param {string} [initialUrl='/'] - Initial URL for server-side rendering
 * @returns {History} History instance
 */
export function getHistory(initialUrl = '/') {
  // Server: always create fresh instance per request to avoid state leaks
  if (!isBrowser) {
    return createMemoryHistory({
      initialEntries: [initialUrl],
      initialIndex: 0,
    });
  }

  // Client: singleton pattern
  if (!browserHistory) {
    browserHistory = createBrowserHistory({ basename: '' });
  }
  return browserHistory;
}

/**
 * Reset history instance
 * Useful for testing or cleaning up between SSR requests
 *
 * @returns {void}
 */
export function resetHistory() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Only reset browser history on client
  if (isBrowser) {
    browserHistory = null;
  }
}

// =============================================================================
// HELPER FUNCTIONS (PRIVATE)
// =============================================================================

/**
 * Generic navigation function
 * @private
 * @param {History} history - History instance to use
 * @param {string} method - History method ('push' or 'replace')
 * @param {string|Object} path - Path or location object
 * @param {Object} [state] - Optional state object
 * @throws {Error} If navigation fails
 */
function navigate(history, method, path, state) {
  if (!path) {
    throw new Error(`navigate: path is required`);
  }

  if (typeof path === 'string') {
    history[method](path, state);
  } else if (typeof path === 'object') {
    history[method](path);
  } else {
    throw new Error(`navigate: path must be a string or location object`);
  }
}

// =============================================================================
// NAVIGATION FUNCTIONS
// =============================================================================

/**
 * Navigate to a new location
 *
 * Adds a new entry to the history stack. On the server, this updates the
 * memory history instance.
 *
 * @param {string|Object} path - Path to navigate to, or location object
 * @param {Object} [state] - Optional state object to associate with the location
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {boolean} True if navigation succeeded, false otherwise
 *
 * @example
 * // Simple path
 * navigateTo('/about');
 *
 * @example
 * // With query string
 * navigateTo('/search?q=react');
 *
 * @example
 * // With state
 * navigateTo('/profile', { from: 'home' });
 *
 * @example
 * // Location object
 * navigateTo({ pathname: '/posts', search: '?page=2', hash: '#comments' });
 *
 * @example
 * // SSR: provide history instance
 * const hist = getHistory('/initial');
 * navigateTo('/about', null, hist);
 */
export function navigateTo(path, state, history) {
  try {
    const hist = history || getHistory();
    navigate(hist, 'push', path, state);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('navigateTo failed:', err);
    }
    return false;
  }
}

/**
 * Replace current location
 *
 * Replaces the current entry in the history stack.
 * Use this instead of navigateTo() when you don't want to add a new history entry.
 *
 * @param {string|Object} path - Path to replace with, or location object
 * @param {Object} [state] - Optional state object to associate with the location
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {boolean} True if replacement succeeded, false otherwise
 *
 * @example
 * // Redirect after login (don't allow back to login page)
 * replaceTo('/dashboard');
 *
 * @example
 * // Replace with state
 * replaceTo('/error', { code: 404 });
 *
 * @example
 * // Location object
 * replaceTo({ pathname: '/home', search: '', hash: '' });
 */
export function replaceTo(path, state, history) {
  try {
    const hist = history || getHistory();
    navigate(hist, 'replace', path, state);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('replaceTo failed:', err);
    }
    return false;
  }
}

/**
 * Go back in history
 *
 * Moves back one entry in the history stack.
 * Equivalent to clicking the browser's back button.
 *
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {boolean} True if navigation succeeded, false otherwise
 *
 * @example
 * goBack();
 */
export function goBack(history) {
  try {
    const hist = history || getHistory();
    hist.go(-1);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('goBack failed:', err);
    }
    return false;
  }
}

/**
 * Go forward in history
 *
 * Moves forward one entry in the history stack.
 * Equivalent to clicking the browser's forward button.
 *
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {boolean} True if navigation succeeded, false otherwise
 *
 * @example
 * goForward();
 */
export function goForward(history) {
  try {
    const hist = history || getHistory();
    hist.go(1);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('goForward failed:', err);
    }
    return false;
  }
}

/**
 * Go to a specific entry in history
 *
 * Moves to a specific entry in the history stack by its relative position.
 *
 * @param {number} n - The relative position in the history stack
 *                     Negative values go back, positive values go forward
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {boolean} True if navigation succeeded, false otherwise
 *
 * @example
 * // Go back 2 pages
 * go(-2);
 *
 * @example
 * // Go forward 1 page
 * go(1);
 */
export function go(n, history) {
  try {
    if (typeof n !== 'number') {
      throw new Error('go: n must be a number');
    }
    const hist = history || getHistory();
    hist.go(n);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('go failed:', err);
    }
    return false;
  }
}

// =============================================================================
// LOCATION FUNCTIONS
// =============================================================================

/**
 * Get current location
 *
 * Returns the current location object containing pathname, search, hash, etc.
 *
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {Object} Location object with pathname, search, hash, state, key
 *
 * @example
 * const location = getCurrentLocation();
 * console.log(location.pathname); // '/about'
 * console.log(location.search);   // '?page=2'
 * console.log(location.hash);     // '#section'
 */
export function getCurrentLocation(history) {
  const hist = history || getHistory();
  return hist.location;
}

/**
 * Get current pathname
 *
 * Returns just the pathname portion of the current location.
 *
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {string} Current pathname
 *
 * @example
 * const pathname = getCurrentPathname();
 * console.log(pathname); // '/about'
 */
export function getCurrentPathname(history) {
  return getCurrentLocation(history).pathname;
}

/**
 * Get current search params
 *
 * Returns the query string portion of the current location.
 *
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {string} Current search string (including '?')
 *
 * @example
 * const search = getCurrentSearch();
 * console.log(search); // '?page=2&sort=name'
 */
export function getCurrentSearch(history) {
  return getCurrentLocation(history).search;
}

/**
 * Get current hash
 *
 * Returns the hash portion of the current location.
 *
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {string} Current hash (including '#')
 *
 * @example
 * const hash = getCurrentHash();
 * console.log(hash); // '#section'
 */
export function getCurrentHash(history) {
  return getCurrentLocation(history).hash;
}

/**
 * Get current state
 *
 * Returns the state object associated with the current location.
 *
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {Object|null} Current state object
 *
 * @example
 * const state = getCurrentState();
 * console.log(state); // { from: '/home' }
 */
export function getCurrentState(history) {
  return getCurrentLocation(history).state || null;
}

// =============================================================================
// EVENT SUBSCRIPTION
// =============================================================================

/**
 * Subscribe to navigation changes
 *
 * Registers a listener that will be called whenever the location changes.
 *
 * @param {Function} listener - Callback function (location, action) => void
 *                              - location: Current location object
 *                              - action: Navigation action (PUSH, REPLACE, POP)
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {Function} Unsubscribe function to stop listening
 *
 * @example
 * const unsubscribe = listen((location, action) => {
 *   console.log('Navigated to:', location.pathname);
 *   console.log('Action:', action); // PUSH, REPLACE, or POP
 * });
 *
 * // Later, stop listening
 * unsubscribe();
 */
export function listen(listener, history) {
  if (typeof listener !== 'function') {
    throw new Error('listen: listener must be a function');
  }
  const hist = history || getHistory();
  return hist.listen(listener);
}

/**
 * Subscribe to navigation changes (singleton pattern)
 *
 * Ensures only one listener is registered at a time on the default history instance.
 * If called multiple times, the previous listener is automatically unsubscribed.
 *
 * Use this in your main application entry point to avoid duplicate subscriptions.
 * For SSR, prefer using listen() with a specific history instance.
 *
 * @param {Function} listener - Callback function (location, action) => void
 * @returns {Function} Unsubscribe function
 *
 * @example
 * // In src/client.js
 * const unsubscribe = subscribe((location, action) => {
 *   onLocationChange(location, action);
 * });
 *
 * // Cleanup on page unload
 * window.addEventListener('beforeunload', unsubscribe);
 */
export function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new Error('subscribe: listener must be a function');
  }

  // Store previous unsubscribe locally to avoid race conditions
  const prevUnsubscribe = unsubscribe;

  // Unsubscribe previous listener
  if (typeof prevUnsubscribe === 'function') {
    prevUnsubscribe();
  }

  // Subscribe new listener
  unsubscribe = getHistory().listen(listener);

  // Return unsubscribe function
  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a URL with query parameters
 *
 * Helper function to build URLs with query strings.
 *
 * @param {string} pathname - Base pathname
 * @param {Object} [params={}] - Query parameters as key-value pairs
 * @param {string} [hash=''] - Optional hash fragment
 * @returns {string} Complete URL with query string and hash
 *
 * @example
 * const url = createUrl('/search', { q: 'react', page: 2 });
 * console.log(url); // '/search?q=react&page=2'
 * navigateTo(url);
 *
 * @example
 * const url = createUrl('/docs', { v: '2' }, '#installation');
 * console.log(url); // '/docs?v=2#installation'
 */
export function createUrl(pathname, params = {}, hash = '') {
  if (typeof pathname !== 'string') {
    throw new Error('createUrl: pathname must be a string');
  }

  // Ensure pathname starts with /
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  const searchParams = new URLSearchParams();

  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value != null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const search = searchParams.toString();
  const queryString = search ? `?${search}` : '';
  const hashString = hash && !hash.startsWith('#') ? `#${hash}` : hash;

  return `${normalizedPath}${queryString}${hashString}`;
}

/**
 * Parse query string into object
 *
 * Helper function to parse URL query parameters.
 *
 * @param {string} [search] - Query string (defaults to current location search)
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {Object} Parsed query parameters
 *
 * @example
 * const params = parseQuery('?page=2&sort=name');
 * console.log(params); // { page: '2', sort: 'name' }
 *
 * @example
 * // Parse current location
 * const params = parseQuery();
 */
export function parseQuery(search, history) {
  const queryString = search || getCurrentSearch(history);
  const params = {};

  if (!queryString) return params;

  const searchParams = new URLSearchParams(queryString);
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

/**
 * Update query parameters while preserving existing ones
 *
 * @param {Object} newParams - New parameters to add/update
 * @param {Object} [options] - Options
 * @param {boolean} [options.replace=false] - Use replace instead of push
 * @param {string[]} [options.remove=[]] - Parameter keys to remove
 * @param {History} [options.history] - Optional history instance
 * @returns {boolean} True if navigation succeeded, false otherwise
 *
 * @example
 * // Current URL: /search?q=react&page=1
 * updateQueryParams({ page: 2, sort: 'date' });
 * // New URL: /search?q=react&page=2&sort=date
 *
 * @example
 * // Remove a parameter
 * updateQueryParams({ page: 2 }, { remove: ['sort'] });
 */
export function updateQueryParams(newParams, options = {}) {
  try {
    const { replace = false, remove = [], history } = options;
    const hist = history || getHistory();
    const currentParams = parseQuery(null, hist);

    // Remove specified params
    remove.forEach(key => {
      delete currentParams[key];
    });

    // Merge with new params
    const mergedParams = { ...currentParams, ...newParams };

    // Remove null/undefined values
    Object.keys(mergedParams).forEach(key => {
      if (mergedParams[key] == null) {
        delete mergedParams[key];
      }
    });

    const pathname = getCurrentPathname(hist);
    const hash = getCurrentHash(hist);
    const url = createUrl(pathname, mergedParams, hash);

    if (replace) {
      return replaceTo(url, null, hist);
    }
    return navigateTo(url, null, hist);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('updateQueryParams failed:', err);
    }
    return false;
  }
}

/**
 * Get query parameter value by key
 *
 * @param {string} key - Parameter key
 * @param {string} [defaultValue=''] - Default value if parameter not found
 * @param {History} [history] - Optional history instance (uses default if not provided)
 * @returns {string} Parameter value
 *
 * @example
 * // Current URL: /search?q=react&page=2
 * getQueryParam('q'); // 'react'
 * getQueryParam('sort', 'date'); // 'date' (default)
 */
export function getQueryParam(key, defaultValue = '', history) {
  if (typeof key !== 'string') {
    throw new Error('getQueryParam: key must be a string');
  }
  const params = parseQuery(null, history);
  return params[key] || defaultValue;
}
