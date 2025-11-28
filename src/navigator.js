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
const isBrowser = typeof window !== 'undefined';

// =============================================================================
// HISTORY INSTANCE
// =============================================================================

/**
 * History instance
 * - Browser: Uses HTML5 History API for client-side navigation
 * - Server: Uses memory history for SSR compatibility
 * @private
 */
const history = isBrowser
  ? createBrowserHistory({ basename: '' })
  : createMemoryHistory({ initialEntries: ['/'] });

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
  if (!history) return;

  try {
    if (typeof path === 'string') {
      history.push(path, state);
    } else {
      history.push(path);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
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
  if (!history) return;

  try {
    if (typeof path === 'string') {
      history.replace(path, state);
    } else {
      history.replace(path);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
  }
}

/**
 * Go back in history
 *
 * Moves back one entry in the history stack. On the server, this is a no-op.
 * Equivalent to clicking the browser's back button.
 *
 * @example
 * goBack();
 */
export function goBack() {
  if (!history || !isBrowser) return;

  try {
    history.goBack();
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
  }
}

/**
 * Go forward in history
 *
 * Moves forward one entry in the history stack. On the server, this is a no-op.
 * Equivalent to clicking the browser's forward button.
 *
 * @example
 * goForward();
 */
export function goForward() {
  if (!history || !isBrowser) return;

  try {
    history.goForward();
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
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
  if (!history || !isBrowser) return;

  try {
    history.go(n);
  } catch (error) {
    if (__DEV__) {
      console.error('Navigation error:', error);
    }
  }
}

// =============================================================================
// LOCATION FUNCTIONS
// =============================================================================

/**
 * Get current location
 *
 * Returns the current location object containing pathname, search, hash, etc.
 * On the server, returns null.
 *
 * @returns {Object|null} Location object with pathname, search, hash, state, key
 *
 * @example
 * const location = getCurrentLocation();
 * console.log(location.pathname); // '/about'
 * console.log(location.search);   // '?page=2'
 * console.log(location.hash);     // '#section'
 */
export function getCurrentLocation() {
  return history ? history.location : null;
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
  return history && history.location ? history.location.pathname : '/';
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
  return history && history.location ? history.location.search : '';
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
  return history && history.location ? history.location.hash : '';
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
  if (!history) {
    // Return no-op unsubscribe function for server-side
    return () => {};
  }

  if (typeof listener !== 'function') {
    if (__DEV__) {
      console.error('onNavigationChange: listener must be a function');
    }
    return () => {};
  }

  try {
    // Subscribe to history changes
    return history.listen(listener);
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
  if (!history) {
    // Return no-op unsubscribe function for server-side
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
    // Subscribe to history changes
    navigationUnsubscribe = history.listen(listener);

    // Return unsubscribe function
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
  return isBrowser && !!history;
}

/**
 * Create a URL with query parameters
 *
 * Helper function to build URLs with query strings.
 *
 * @param {string} pathname - Base pathname
 * @param {Object} params - Query parameters as key-value pairs
 * @returns {string} Complete URL with query string
 *
 * @example
 * const url = createUrl('/search', { q: 'react', page: 2 });
 * console.log(url); // '/search?q=react&page=2'
 * navigateTo(url);
 */
export function createUrl(pathname, params = {}) {
  const searchParams = new URLSearchParams();

  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value != null) {
      searchParams.append(key, String(value));
    }
  });

  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
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
