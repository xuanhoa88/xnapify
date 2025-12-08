/**
 * React Starter Kit - Isomorphic Navigation Module
 * Works on both server (memory history) and client (browser history)
 */

import { createBrowserHistory, createMemoryHistory } from 'history';

// =============================================================================
// CONSTANTS & STATE
// =============================================================================

const isBrowser = typeof window !== 'undefined';
let browserHistory = null;
let unsubscribe = null;

// =============================================================================
// HISTORY MANAGEMENT
// =============================================================================

/**
 * Get history instance (singleton on client, fresh on server)
 * @param {string} [initialUrl='/'] - Initial URL for SSR
 */
export function getHistory(initialUrl = '/') {
  if (!isBrowser) {
    return createMemoryHistory({
      initialEntries: [initialUrl],
      initialIndex: 0,
    });
  }
  if (!browserHistory) {
    browserHistory = createBrowserHistory({ basename: '' });
  }
  return browserHistory;
}

/** Reset history instance (for testing/cleanup) */
export function resetHistory() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (isBrowser) browserHistory = null;
}

// =============================================================================
// NAVIGATION
// =============================================================================

/**
 * Navigate to a new location (push)
 * @param {string|Object} path - Path or location object
 * @param {Object} [state] - State to associate with location
 * @param {History} [history] - Optional history instance
 */
export function navigateTo(path, state, history) {
  try {
    const hist = history || getHistory();
    if (typeof path === 'string') {
      hist.push(path, state);
    } else {
      hist.push(path);
    }
    return true;
  } catch (err) {
    if (__DEV__) console.error('navigateTo failed:', err);
    return false;
  }
}

/**
 * Replace current location
 * @param {string|Object} path - Path or location object
 * @param {Object} [state] - State to associate with location
 * @param {History} [history] - Optional history instance
 */
export function replaceTo(path, state, history) {
  try {
    const hist = history || getHistory();
    if (typeof path === 'string') {
      hist.replace(path, state);
    } else {
      hist.replace(path);
    }
    return true;
  } catch (err) {
    if (__DEV__) console.error('replaceTo failed:', err);
    return false;
  }
}

/** Go back in history */
export function goBack(history) {
  try {
    (history || getHistory()).go(-1);
    return true;
  } catch (err) {
    if (__DEV__) console.error('goBack failed:', err);
    return false;
  }
}

/** Go forward in history */
export function goForward(history) {
  try {
    (history || getHistory()).go(1);
    return true;
  } catch (err) {
    if (__DEV__) console.error('goForward failed:', err);
    return false;
  }
}

/** Go to relative position in history */
export function go(n, history) {
  try {
    (history || getHistory()).go(n);
    return true;
  } catch (err) {
    if (__DEV__) console.error('go failed:', err);
    return false;
  }
}

// =============================================================================
// LOCATION GETTERS
// =============================================================================

/** Get current location object */
export function getCurrentLocation(history) {
  return (history || getHistory()).location;
}

/** Get current pathname */
export function getCurrentPathname(history) {
  return getCurrentLocation(history).pathname;
}

/** Get current search string */
export function getCurrentSearch(history) {
  return getCurrentLocation(history).search;
}

/** Get current hash */
export function getCurrentHash(history) {
  return getCurrentLocation(history).hash;
}

/** Get current state */
export function getCurrentState(history) {
  return getCurrentLocation(history).state || null;
}

// =============================================================================
// EVENT SUBSCRIPTION
// =============================================================================

/**
 * Subscribe to navigation changes
 * @param {Function} listener - (location, action) => void
 * @param {History} [history] - Optional history instance
 * @returns {Function} Unsubscribe function
 */
export function listen(listener, history) {
  if (typeof listener !== 'function') {
    throw new Error('listen: listener must be a function');
  }
  return (history || getHistory()).listen(listener);
}

/**
 * Subscribe to navigation (singleton - auto-unsubscribes previous)
 * @param {Function} listener - (location, action) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new Error('subscribe: listener must be a function');
  }
  if (typeof unsubscribe === 'function') unsubscribe();
  unsubscribe = getHistory().listen(listener);
  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

// =============================================================================
// URL UTILITIES
// =============================================================================

/**
 * Create URL with query params
 * @param {string} pathname - Base path
 * @param {Object} [params={}] - Query parameters
 * @param {string} [hash=''] - Hash fragment
 */
export function createUrl(pathname, params = {}, hash = '') {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const search = searchParams.toString();
  const hashStr = hash && !hash.startsWith('#') ? `#${hash}` : hash;
  return `${path}${search ? `?${search}` : ''}${hashStr}`;
}

/**
 * Parse query string to object
 * @param {string} [search] - Query string (defaults to current)
 * @param {History} [history] - Optional history instance
 */
export function parseQuery(search, history) {
  const queryString = search || getCurrentSearch(history);
  if (!queryString) return {};

  const params = {};
  new URLSearchParams(queryString).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * Update query params (merge with existing)
 * @param {Object} newParams - New parameters
 * @param {Object} [options] - { replace, remove, history }
 */
export function updateQueryParams(newParams, options = {}) {
  try {
    const { replace = false, remove = [], history } = options;
    const hist = history || getHistory();
    const currentParams = parseQuery(null, hist);

    // Remove specified keys
    remove.forEach(key => delete currentParams[key]);

    // Merge and clean null values
    const merged = { ...currentParams, ...newParams };
    Object.keys(merged).forEach(key => {
      if (merged[key] == null) delete merged[key];
    });

    const url = createUrl(
      getCurrentPathname(hist),
      merged,
      getCurrentHash(hist),
    );
    return replace ? replaceTo(url, null, hist) : navigateTo(url, null, hist);
  } catch (err) {
    if (__DEV__) console.error('updateQueryParams failed:', err);
    return false;
  }
}

/**
 * Get single query param
 * @param {string} key - Parameter key
 * @param {string} [defaultValue=''] - Default if not found
 * @param {History} [history] - Optional history instance
 */
export function getQueryParam(key, defaultValue = '', history) {
  return parseQuery(null, history)[key] || defaultValue;
}
