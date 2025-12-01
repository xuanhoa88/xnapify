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

/**
 * Check if code is running in browser environment
 * @private
 */
const IS_BROWSER = typeof window !== 'undefined';

// =============================================================================
// HISTORY INSTANCE (LAZY INITIALIZATION)
// =============================================================================

/**
 * History instance (lazy-initialized)
 * @private
 */
let history = null;

/**
 * Initialize history instance
 * @private
 * @returns {History} History instance
 */
export function getHistory() {
  if (!history) {
    history = IS_BROWSER
      ? createBrowserHistory({ basename: '' })
      : createMemoryHistory({ initialEntries: ['/'] });
  }
  return history;
}

/**
 * Reset history instance (useful for testing)
 * @private
 */
export function resetHistory() {
  if (navigationUnsubscribe) {
    navigationUnsubscribe();
    navigationUnsubscribe = null;
  }
  history = null;
}

// =============================================================================
// NAVIGATION FUNCTIONS
// =============================================================================

/**
 * Navigate to a new location
 *
 * Adds a new entry to the history stack. On the server, this is a no-op.
 *
 * @param {string|Object} path - Path to navigate to, or location object
 * @param {Object} [state] - Optional state object to associate with the location
 * @returns {boolean} True if navigation succeeded
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
 */
export function navigateTo(path, state) {
  if (!IS_BROWSER) return false;

  try {
    const hist = getHistory();
    if (typeof path === 'string') {
      hist.push(path, state);
    } else {
      hist.push(path);
    }
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
    return false;
  }
}

/**
 * Replace current location
 *
 * Replaces the current entry in the history stack. On the server, this is a no-op.
 * Use this instead of navigateTo() when you don't want to add a new history entry.
 *
 * @param {string|Object} path - Path to replace with, or location object
 * @param {Object} [state] - Optional state object to associate with the location
 * @returns {boolean} True if replacement succeeded
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
export function replaceTo(path, state) {
  if (!IS_BROWSER) return false;

  try {
    const hist = getHistory();
    if (typeof path === 'string') {
      hist.replace(path, state);
    } else {
      hist.replace(path);
    }
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
    return false;
  }
}

/**
 * Go back in history
 *
 * Moves back one entry in the history stack. On the server, this is a no-op.
 * Equivalent to clicking the browser's back button.
 *
 * @returns {boolean} True if navigation succeeded
 *
 * @example
 * goBack();
 */
export function goBack() {
  if (!IS_BROWSER) return false;

  try {
    getHistory().back();
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
    return false;
  }
}

/**
 * Go forward in history
 *
 * Moves forward one entry in the history stack. On the server, this is a no-op.
 * Equivalent to clicking the browser's forward button.
 *
 * @returns {boolean} True if navigation succeeded
 *
 * @example
 * goForward();
 */
export function goForward() {
  if (!IS_BROWSER) return false;

  try {
    getHistory().forward();
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
    return false;
  }
}

/**
 * Go to a specific entry in history
 *
 * Moves to a specific entry in the history stack by its relative position.
 * On the server, this is a no-op.
 *
 * @param {number} n - The relative position in the history stack
 *                     Negative values go back, positive values go forward
 * @returns {boolean} True if navigation succeeded
 *
 * @example
 * // Go back 2 pages
 * go(-2);
 *
 * @example
 * // Go forward 1 page
 * go(1);
 */
export function go(n) {
  if (!IS_BROWSER) return false;

  try {
    getHistory().go(n);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
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
 * On the server, returns a default location object.
 *
 * @returns {Object} Location object with pathname, search, hash, state, key
 *
 * @example
 * const location = getCurrentLocation();
 * console.log(location.pathname); // '/about'
 * console.log(location.search);   // '?page=2'
 * console.log(location.hash);     // '#section'
 */
export function getCurrentLocation() {
  if (!IS_BROWSER) {
    return { pathname: '/', search: '', hash: '', state: null, key: 'default' };
  }
  return getHistory().location;
}

/**
 * Get current pathname
 *
 * Returns just the pathname portion of the current location.
 * On the server, returns '/'.
 *
 * @returns {string} Current pathname
 *
 * @example
 * const pathname = getCurrentPathname();
 * console.log(pathname); // '/about'
 */
export function getCurrentPathname() {
  return getCurrentLocation().pathname;
}

/**
 * Get current search params
 *
 * Returns the query string portion of the current location.
 * On the server, returns empty string.
 *
 * @returns {string} Current search string (including '?')
 *
 * @example
 * const search = getCurrentSearch();
 * console.log(search); // '?page=2&sort=name'
 */
export function getCurrentSearch() {
  return getCurrentLocation().search;
}

/**
 * Get current hash
 *
 * Returns the hash portion of the current location.
 * On the server, returns empty string.
 *
 * @returns {string} Current hash (including '#')
 *
 * @example
 * const hash = getCurrentHash();
 * console.log(hash); // '#section'
 */
export function getCurrentHash() {
  return getCurrentLocation().hash;
}

/**
 * Get current state
 *
 * Returns the state object associated with the current location.
 * On the server, returns null.
 *
 * @returns {Object|null} Current state object
 *
 * @example
 * const state = getCurrentState();
 * console.log(state); // { from: '/home' }
 */
export function getCurrentState() {
  return getCurrentLocation().state;
}

// =============================================================================
// EVENT SUBSCRIPTION
// =============================================================================

/**
 * Subscribe to navigation changes
 *
 * Registers a listener that will be called whenever the location changes.
 * On the server, returns a no-op unsubscribe function.
 *
 * @param {Function} listener - Callback function (location, action) => void
 *                              - location: Current location object
 *                              - action: Navigation action (PUSH, REPLACE, POP)
 * @returns {Function} Unsubscribe function to stop listening
 *
 * @example
 * const unsubscribe = onNavigationChange((location, action) => {
 *   console.log('Navigated to:', location.pathname);
 *   console.log('Action:', action); // PUSH, REPLACE, or POP
 * });
 *
 * // Later, stop listening
 * unsubscribe();
 */
export function onNavigationChange(listener) {
  if (!IS_BROWSER) {
    return () => {};
  }

  if (typeof listener !== 'function') {
    if (__DEV__) {
      console.error('onNavigationChange: listener must be a function');
    }
    return () => {};
  }

  try {
    return getHistory().listen(listener);
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation subscription error:', error);
    }
    return () => {};
  }
}

/**
 * Subscribe to navigation changes (singleton pattern)
 *
 * Ensures only one listener is registered at a time. If called multiple times,
 * the previous listener is automatically unsubscribed.
 * On the server, returns a no-op unsubscribe function.
 *
 * Use this in your main application entry point to avoid duplicate subscriptions.
 *
 * @param {Function} listener - Callback function (location, action) => void
 * @returns {Function} Unsubscribe function
 *
 * @example
 * // In src/client.js
 * const unsubscribe = subscribeToNavigation((location, action) => {
 *   onLocationChange(location, action);
 * });
 *
 * // Cleanup on page unload
 * window.addEventListener('beforeunload', unsubscribe);
 */
let navigationUnsubscribe = null;

export function subscribeToNavigation(listener) {
  if (!IS_BROWSER) {
    return () => {};
  }

  if (typeof listener !== 'function') {
    if (__DEV__) {
      console.error('subscribeToNavigation: listener must be a function');
    }
    return () => {};
  }

  // If already subscribed, unsubscribe first to avoid duplicates
  if (typeof navigationUnsubscribe === 'function') {
    navigationUnsubscribe();
    navigationUnsubscribe = null;
  }

  try {
    navigationUnsubscribe = getHistory().listen(listener);

    return () => {
      if (typeof navigationUnsubscribe === 'function') {
        navigationUnsubscribe();
        navigationUnsubscribe = null;
      }
    };
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation subscription error:', error);
    }
    return () => {};
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if navigation is available
 *
 * Returns true if running in browser with history support.
 *
 * @returns {boolean} True if navigation is available
 *
 * @example
 * if (isNavigationAvailable()) {
 *   navigateTo('/about');
 * }
 */
export function isNavigationAvailable() {
  return IS_BROWSER;
}

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

  return `${pathname}${queryString}${hashString}`;
}

/**
 * Parse query string into object
 *
 * Helper function to parse URL query parameters.
 *
 * @param {string} [search] - Query string (defaults to current location search)
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
export function parseQuery(search) {
  const queryString = search || getCurrentSearch();
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
 * @returns {boolean} True if navigation succeeded
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
  if (!IS_BROWSER) return false;

  const { replace = false, remove = [] } = options;
  const currentParams = parseQuery();

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

  const pathname = getCurrentPathname();
  const hash = getCurrentHash();
  const url = createUrl(pathname, mergedParams, hash);

  return replace ? replaceTo(url) : navigateTo(url);
}

/**
 * Check if current path matches a pattern
 *
 * @param {string|RegExp} pattern - Path pattern to match
 * @param {Object} [options] - Options
 * @param {boolean} [options.exact=false] - Require exact match
 * @returns {boolean} True if current path matches pattern
 *
 * @example
 * // Current path: /blog/post-1
 * matchPath('/blog'); // true
 * matchPath('/blog', { exact: true }); // false
 * matchPath(/^\/blog\//); // true
 */
export function matchPath(pattern, options = {}) {
  const { exact = false } = options;
  const pathname = getCurrentPathname();

  if (pattern instanceof RegExp) {
    return pattern.test(pathname);
  }

  if (exact) {
    return pathname === pattern;
  }

  return pathname.startsWith(pattern);
}

/**
 * Get query parameter value by key
 *
 * @param {string} key - Parameter key
 * @param {string} [defaultValue=''] - Default value if parameter not found
 * @returns {string} Parameter value
 *
 * @example
 * // Current URL: /search?q=react&page=2
 * getQueryParam('q'); // 'react'
 * getQueryParam('sort', 'date'); // 'date' (default)
 */
export function getQueryParam(key, defaultValue = '') {
  const params = parseQuery();
  return params[key] ?? defaultValue;
}

/**
 * Navigate with confirmation
 *
 * Shows a confirmation dialog before navigating
 *
 * @param {string|Object} path - Path to navigate to
 * @param {string} message - Confirmation message
 * @param {Object} [state] - Optional state object
 * @returns {boolean} True if user confirmed and navigation succeeded
 *
 * @example
 * navigateWithConfirm('/delete', 'Are you sure you want to leave?');
 */
export function navigateWithConfirm(path, message, state) {
  if (!IS_BROWSER) return false;

  if (window.confirm(message)) {
    return navigateTo(path, state);
  }

  return false;
}
