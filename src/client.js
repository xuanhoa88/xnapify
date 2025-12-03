/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { loadableReady } from '@loadable/component';
import queryString from 'query-string';
import 'whatwg-fetch';
import App from './components/App';
import { createFetch } from './createFetch';
import { DEFAULT_LOCALE, getI18nInstance } from './i18n';
import * as navigator from './navigator';
import { configureStore, getCurrentUser } from './redux';

// Get i18n instance
const i18n = getI18nInstance();

/**
 * Update document title
 */
function updateTitle(title) {
  if (title) {
    document.title = title;
  }
}

/**
 * Update or create meta tag
 */
function updateMeta(name, content, isProperty = false) {
  if (!content) return;

  const attribute = isProperty ? 'property' : 'name';
  let meta = document.querySelector(`meta[${attribute}="${name}"]`);

  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', content);
}

/**
 * Update or create link tag
 */
function updateLink(rel, href, attributes = {}) {
  if (!href) return;

  let link = document.querySelector(
    `link[rel="${rel}"]${href ? `[href="${href}"]` : ''}`,
  );

  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }

  link.setAttribute('href', href);

  Object.keys(attributes).forEach(key => {
    link.setAttribute(key, attributes[key]);
  });
}

/**
 * Update page metadata after route changes
 * @param {Object} metadata - Page metadata (title, description, image, url, type)
 */
function updatePageMetadata({
  title,
  description,
  image,
  url,
  type = 'website',
}) {
  if (title) {
    updateTitle(title);
    updateMeta('og:title', title, true);
    updateMeta('twitter:title', title);
  }

  if (description) {
    updateMeta('description', description);
    updateMeta('og:description', description, true);
    updateMeta('twitter:description', description);
  }

  if (image) {
    updateMeta('og:image', image, true);
    updateMeta('twitter:image', image);
  }

  if (url) {
    updateMeta('og:url', url, true);
    updateLink('canonical', url);
  }

  if (type) {
    updateMeta('og:type', type, true);
  }
}

/**
 * Handle hydration errors (UPDATED - for use in hydrateRoot callback)
 */
function handleHydrationError(error) {
  if (__DEV__) {
    console.error('Hydration error:', error);
    trackError({
      type: 'hydration',
      error,
    });
  }
}

/**
 * Handle render errors (UPDATED - for use in createRoot callback)
 */
function handleRenderError(error) {
  if (__DEV__) {
    console.error('Render error:', error);
    trackError({
      type: 'render',
      error,
    });
  }
}

/**
 * Ensure i18n is properly synced before hydration
 */
async function ensureI18n() {
  const serverLocale = store.getState().intl && store.getState().intl.locale;
  if (serverLocale && i18n.language !== serverLocale) {
    // Wait for language change to complete
    await i18n.changeLanguage(serverLocale);

    if (__DEV__) {
      console.log('✅ i18n synced:', {
        server: serverLocale,
        client: i18n.language,
      });
    }
  }
}

/**
 * Initialize user authentication
 * Fetches current user from server if not in preloaded state
 */
async function initializeAuth() {
  const state = store.getState();
  const { user } = state;

  // If no user in state, try to fetch from server (JWT cookie will be sent automatically)
  if (!user || !user.id) {
    try {
      await store.dispatch(getCurrentUser());
      if (__DEV__) {
        console.log('✅ User authenticated from session');
      }
    } catch {
      // User not authenticated or token invalid - this is fine
      if (__DEV__) {
        console.log('ℹ️ No authenticated user');
      }
    }
  } else if (__DEV__) {
    console.log('✅ User loaded from SSR state');
  }
}

// Create an enhanced version of fetch with additional features
const fetch = createFetch(window.fetch);

// Initialize Redux store with server state
// eslint-disable-next-line no-underscore-dangle
const appState = window.__PRELOAD_STATE__ || { reduxState: {} };
const store = configureStore(appState.reduxState, { fetch, i18n });

// Application context object that provides shared dependencies and state
// to components throughout the application
const context = {
  store,
  fetch,
  i18n,
  get locale() {
    const { intl } = store.getState();
    return (intl && intl.locale) || DEFAULT_LOCALE;
  },
};

// React 18+ root instance (cached for re-renders, null for React 16/17)
// Using a global variable to persist across HMR updates
const ROOT_INSTANCE_KEY = '__reactRoot';

// Current location state
let currentLocation = navigator.getCurrentLocation();

// Navigation subscription cleanup function
let unsubscribeNavigation = null;

// Scroll position cache for back/forward navigation
const scrollPositionsHistory = {};

// Maximum number of scroll positions to keep in history
const MAX_SCROLL_HISTORY = 50;

// Performance tracking (development only)
const performanceMetrics = __DEV__
  ? {
      navigationCount: 0,
      errors: [],
      lastNavigationTime: null,
      slowNavigations: [],
    }
  : null;

// Navigation state management
let isNavigating = false;
let navigationAbortController = null;

/**
 * Save current scroll position for back/forward navigation
 */
function saveScrollPosition() {
  if (currentLocation && currentLocation.key) {
    scrollPositionsHistory[currentLocation.key] = {
      scrollX: window.pageXOffset,
      scrollY: window.pageYOffset,
      timestamp: Date.now(),
    };

    // Clean up old positions to prevent memory leaks
    const keys = Object.keys(scrollPositionsHistory);
    if (keys.length > MAX_SCROLL_HISTORY) {
      // Sort by timestamp and remove oldest entries
      const sortedKeys = keys.sort((a, b) => {
        const timeA = scrollPositionsHistory[a].timestamp || 0;
        const timeB = scrollPositionsHistory[b].timestamp || 0;
        return timeA - timeB;
      });

      // Remove the oldest 25% of entries
      const removeCount = Math.floor(keys.length * 0.25);
      sortedKeys.slice(0, removeCount).forEach(key => {
        delete scrollPositionsHistory[key];
      });
    }
  }
}

/**
 * Restore scroll position or scroll to hash target
 */
function restoreScrollPosition(location) {
  // Handle hash navigation (e.g., #section-id)
  if (location.hash) {
    const element = document.querySelector(location.hash);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  // Restore saved scroll position for back/forward navigation
  const scrollPosition = scrollPositionsHistory[location.key];
  if (scrollPosition) {
    window.scrollTo(scrollPosition.scrollX, scrollPosition.scrollY);
  } else {
    // Default: scroll to top for new navigation
    window.scrollTo(0, 0);
  }
}

/**
 * Track navigation performance
 */
function trackNavigationPerformance(startTime, route) {
  if (!isPerformanceTrackingEnabled()) {
    return;
  }

  const navigationDuration = performance.now() - startTime;

  // Update metrics
  updateNavigationMetrics(navigationDuration);

  // Track slow navigations (over 1 second)
  if (navigationDuration > 1000) {
    trackSlowNavigation(route.path || '/', navigationDuration);
  }
}

/**
 * Check if performance tracking is enabled
 * @returns {boolean}
 */
function isPerformanceTrackingEnabled() {
  return __DEV__ && performanceMetrics != null;
}

/**
 * Track an error in performance metrics
 * @param {Object} errorData - Error data to track
 * @param {string} errorData.type - Type of error (e.g., 'hydration', 'render', 'navigation')
 * @param {Error|string} errorData.error - Error object or message
 * @param {string} [errorData.stack] - Error stack trace
 * @param {Object} [additionalData] - Additional data to merge
 */
function trackError(errorData, additionalData = {}) {
  if (!isPerformanceTrackingEnabled() || !performanceMetrics.errors) {
    return;
  }

  const error = errorData && errorData.error;
  const type = (errorData && errorData.type) || 'unknown';
  const stack = (errorData && errorData.stack) || (error && error.stack);
  const message = typeof error === 'string' ? error : error && error.message;
  const errorEntry = Object.assign(
    {
      timestamp: Date.now(),
      message,
      stack,
      type,
    },
    additionalData,
  );

  performanceMetrics.errors.push(errorEntry);

  // Keep only last 20 errors to prevent memory bloat
  if (performanceMetrics.errors.length > 20) {
    performanceMetrics.errors.shift();
  }

  // Log error in development
  console.error(`❌ [${errorEntry.type}]:`, errorEntry.message);
}

/**
 * Track slow navigation performance
 * @param {string} path - Route path
 * @param {number} duration - Navigation duration in ms
 */
function trackSlowNavigation(path, duration) {
  if (!isPerformanceTrackingEnabled()) {
    return;
  }

  const slowNavigation = {
    path,
    duration,
    timestamp: Date.now(),
  };

  performanceMetrics.slowNavigations.push(slowNavigation);

  console.warn(`⚠️ Slow navigation to ${path}: ${duration.toFixed(2)}ms`);

  // Keep only last 10 slow navigations
  if (performanceMetrics.slowNavigations.length > 10) {
    performanceMetrics.slowNavigations.shift();
  }
}

/**
 * Update navigation metrics
 * @param {number} duration - Navigation duration in ms
 */
function updateNavigationMetrics(duration) {
  if (!isPerformanceTrackingEnabled()) {
    return;
  }

  performanceMetrics.navigationCount += 1;
  performanceMetrics.lastNavigationTime = duration;
}

/**
 * Get current performance summary
 */
function getPerformanceSummary() {
  if (!isPerformanceTrackingEnabled()) {
    return null;
  }

  return {
    totalNavigations: performanceMetrics.navigationCount,
    lastNavigationTime: performanceMetrics.lastNavigationTime,
    slowNavigations: performanceMetrics.slowNavigations.length,
    totalErrors: performanceMetrics.errors.length,
    recentErrors: performanceMetrics.errors.slice(-5), // Last 5 errors
  };
}

/**
 * Handle navigation errors and reload page if needed
 */
function handleNavigationError(error, isInitialRender, location) {
  // In development, log detailed error information
  if (__DEV__) {
    console.error('❌ Navigation error:', error);

    // Track error using helper
    trackError(
      {
        type: 'navigation',
        error,
      },
      {
        location: location.pathname,
        isInitialRender,
      },
    );

    // In development, don't auto-reload - show error for debugging
    throw error;
  }

  // Production error handling
  if (isInitialRender) {
    console.error('Failed to load initial route, reloading...');
    window.location.reload();
    return;
  }

  // Handle chunk loading errors
  if (
    error &&
    (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk'))
  ) {
    console.warn('Chunk load error detected, reloading page...');
    window.location.reload();
    return;
  }

  // Dispatch error to Redux
  store.dispatch({
    type: 'NAVIGATION_ERROR',
    payload: {
      error: {
        message: error.message,
        stack: error.stack,
      },
      location,
      timestamp: Date.now(),
    },
  });
}

/**
 * Abort current navigation if in progress
 */
function abortNavigation() {
  if (navigationAbortController) {
    navigationAbortController.abort();
    navigationAbortController = null;
  }
  isNavigating = false;
}

// Track if initial hydration has completed
let hasHydrated = false;

/**
 * Handle route change
 * @param {*} router
 * @param {*} location
 * @param {*} action
 * @returns
 */
async function handleRouteChange(location, action) {
  const navigationStartTime = performance.now();

  // Abort any in-progress navigation
  if (isNavigating) {
    abortNavigation();
  }

  // Create new abort controller for this navigation
  navigationAbortController = new AbortController();
  const navigationSignal = navigationAbortController.signal;

  // Set navigation lock to prevent concurrent navigations
  isNavigating = true;

  // Save current scroll position before navigation
  saveScrollPosition();

  // Handle different navigation actions
  if (action === 'PUSH') {
    // Clear scroll position for new forward navigation
    delete scrollPositionsHistory[location.key];
  }

  // Set loading state
  store.dispatch({ type: 'NAVIGATION_START', payload: { location, action } });

  // Add a small delay to prevent flicker for fast loads
  const loadingTimeout = setTimeout(() => {
    store.dispatch({ type: 'NAVIGATION_LOADING', payload: true });
  }, 150);

  currentLocation = location;

  const isInitialRender = !action;

  try {
    // Check if navigation was aborted
    if (navigationSignal.aborted) {
      return;
    }

    // Create router instance
    const router = await import('./pages').then(m => m.default());

    // Set context for route resolution
    context.pathname = location.pathname;
    context.query = queryString.parse(location.search);

    // Resolve the route
    const route = await router.resolve(context);

    // If route not found, throw 404 error
    if (!route) {
      const error = new Error(`Route ${location.pathname} not found`);
      error.status = 404;
      throw error;
    }

    // Check if navigation was aborted after route resolution
    if (navigationSignal.aborted) {
      return;
    }

    // Guard against outdated navigation
    if (currentLocation.key !== location.key) {
      return;
    }

    // Handle redirects
    if (route.redirect) {
      window.location.href = route.redirect;
      return;
    }

    // Update store with new route data
    store.dispatch({
      type: 'NAVIGATION_SUCCESS',
      payload: {
        route,
        location,
        action,
      },
    });

    // Create the root application element
    const appElement = <App context={context}>{route.component}</App>;

    // Import React 18 root APIs
    let ReactDOMClient;
    try {
      ReactDOMClient = await import('react-dom/client');
    } catch {
      ReactDOMClient = null;
    }

    // DOM container for React app
    const container = document.getElementById('app');
    if (!container) {
      console.error('Failed to find root DOM element');
      return;
    }

    // Detect if React 18 is available
    const hasReact18 =
      ReactDOMClient &&
      typeof ReactDOMClient.createRoot === 'function' &&
      typeof ReactDOMClient.hydrateRoot === 'function';

    if (hasReact18) {
      // React 18 Rendering Logic
      const { createRoot, hydrateRoot } = ReactDOMClient;

      try {
        let root = window[ROOT_INSTANCE_KEY];
        if (!root) {
          // First render (SSR hydration preferred)
          try {
            root = hydrateRoot(container, appElement, {
              onRecoverableError: handleHydrationError,
            });
            if (__DEV__) console.log('✅ Initial hydration completed');
          } catch (err) {
            console.warn('Hydration failed, using client render:', err);
            root = createRoot(container, {
              onRecoverableError: handleRenderError,
            });
            root.render(appElement);
          }
          window[ROOT_INSTANCE_KEY] = root;
          hasHydrated = true;
        } else {
          // HMR or subsequent renders
          root.render(appElement);
          if (__DEV__ && action === 'HMR_UPDATE')
            console.log('✅ HMR render completed');
        }
      } catch (error) {
        console.error('Render error:', error);
        if (window[ROOT_INSTANCE_KEY]) {
          try {
            window[ROOT_INSTANCE_KEY].unmount();
          } catch (e) {
            console.error('Unmount failed:', e);
          }
          delete window[ROOT_INSTANCE_KEY];
        }
      }
    } else {
      // React 16/17 Fallback
      const ReactDOM = await import('react-dom');

      // eslint-disable-next-line react/no-deprecated
      const method =
        // eslint-disable-next-line react/no-deprecated
        isInitialRender && !hasHydrated ? ReactDOM.hydrate : ReactDOM.render;
      method(appElement, container);

      if (isInitialRender) {
        hasHydrated = true;
      }
    }

    // Update page metadata
    if (route.title || route.description) {
      updatePageMetadata({
        title: route.title,
        description: route.description,
        url: window.location.href,
      });
    }

    // Restore scroll position after render
    requestAnimationFrame(() => {
      restoreScrollPosition(location);
    });

    // Track navigation performance
    trackNavigationPerformance(navigationStartTime, route);
  } catch (error) {
    // Don't handle aborted navigations as errors
    if (navigationSignal.aborted) {
      return;
    }

    handleNavigationError(error, isInitialRender, location);
  } finally {
    clearTimeout(loadingTimeout);
    store.dispatch({ type: 'NAVIGATION_LOADING', payload: false });

    // Reset navigation lock
    isNavigating = false;
    navigationAbortController = null;
  }
}

// =============================================================================
// Cleanup function with page unload detection
// =============================================================================

function cleanup() {
  saveScrollPosition();

  if (typeof unsubscribeNavigation === 'function') {
    unsubscribeNavigation();
    unsubscribeNavigation = null;
  }

  abortNavigation();

  if (__DEV__) {
    console.log('✅ Client cleanup completed');

    const summary = getPerformanceSummary();
    if (summary) {
      console.log('📊 Performance Metrics:', summary);
    }
  }
}

// =============================================================================
// Initialize app with page unload handler
// =============================================================================

async function initializeApp() {
  // Ensure i18n is synced BEFORE any rendering
  await ensureI18n();

  // Initialize user authentication from session
  await initializeAuth();

  // Get current location
  currentLocation = navigator.getCurrentLocation();

  // Subscribe to navigation changes
  unsubscribeNavigation = navigator.subscribe(handleRouteChange);

  // Pass true to indicate actual page unload
  window.addEventListener('beforeunload', cleanup);

  // Set up scroll position tracking with debouncing
  let scrollTimeout;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(saveScrollPosition, 100);
    },
    { passive: true },
  );

  if (__DEV__) {
    console.log('🚀 Client app initialized');
  }

  // Trigger initial route rendering
  handleRouteChange(currentLocation);
}

// =============================================================================
// APPLICATION STARTUP
// =============================================================================

const READY_STATES = new Set(['interactive', 'complete']);
let isDOMReady = READY_STATES.has(document.readyState) && !!document.body;
let areChunksLoaded = false;
let hasStarted = false;

/**
 * Start app when both DOM and chunks are ready
 */
function attemptStartup() {
  // Ensure startup only happens once
  if (hasStarted) {
    return;
  }

  if (isDOMReady && areChunksLoaded) {
    hasStarted = true;

    if (__DEV__) {
      console.log('✅ All prerequisites met, starting app...');
    }

    initializeApp();
  } else if (__DEV__) {
    console.log('⏳ Waiting for prerequisites:', {
      isDOMReady,
      areChunksLoaded,
    });
  }
}

// Wait for code-split chunks to load
loadableReady(() => {
  if (__DEV__) {
    console.log('✅ Code-split chunks loaded');
  }
  areChunksLoaded = true;
  attemptStartup();
});

// Wait for DOM to be ready
if (isDOMReady) {
  if (__DEV__) {
    console.log('✅ DOM already ready');
  }
  attemptStartup();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (__DEV__) {
      console.log('✅ DOM content loaded');
    }
    isDOMReady = true;
    attemptStartup();
  });
}

// ===========================
// HMR: Hot Module Replacement
// ===========================
if (module.hot) {
  // Accept updates for this module (e.g., router updates)
  module.hot.accept(err => {
    if (err) {
      console.error('❌ HMR: Error accepting Client update:', err);
      return;
    }

    // Store current location so we can restore after HMR update
    const locationToRestore = { ...currentLocation };

    // Use requestIdleCallback if available for non-blocking update,
    // otherwise fallback to setTimeout for older browsers
    const scheduleUpdate = window.requestIdleCallback || setTimeout;
    const clearUpdate = window.cancelIdleCallback || clearTimeout;

    // Schedule the update
    const updateId = scheduleUpdate(
      () => {
        // Only trigger location change if the pathname matches
        if (currentLocation.pathname === locationToRestore.pathname) {
          handleRouteChange(locationToRestore, 'HMR_UPDATE');
        }
      },
      typeof window.requestIdleCallback === 'function'
        ? { timeout: 1000 } // Timeout for requestIdleCallback
        : 1000, // Delay for setTimeout fallback
    );

    // Store HMR data for this module so it can be cleaned up on dispose
    if (!module.hot.data) {
      module.hot.data = {};
    }
    module.hot.data.pendingUpdate = updateId;
    module.hot.data.clearUpdate = clearUpdate;
  });

  // HMR: Status handler
  module.hot.addStatusHandler(status => {
    if (status === 'idle') {
      // When HMR is done applying updates, notify overlay/reporters
      // eslint-disable-next-line no-underscore-dangle
      const reporter = window.__webpack_hot_middleware_reporter__;
      if (reporter && typeof reporter.success === 'function') {
        reporter.success(); // Clears any previous error overlay
      }
    }
  });

  // Dispose handler
  module.hot.dispose(data => {
    console.log('🔥 HMR: Disposing module');

    // Cancel any pending scheduled updates to avoid calling outdated state
    if (data && data.pendingUpdate && typeof data.clearUpdate === 'function') {
      data.clearUpdate(data.pendingUpdate);
    }

    // Perform module-specific cleanup (e.g., remove event listeners)
    cleanup();
  });
}
