/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'url-polyfill';
import 'whatwg-fetch';
import { createBrowserHistory } from 'history';
import { createFetch } from './shared/fetch';
import {
  configureStore,
  refreshToken,
  logout,
  isAuthenticated,
} from './shared/renderer/redux';
import i18n, { DEFAULT_LOCALE } from './shared/i18n';
import {
  createWebSocketClient,
  EventType,
  MessageType,
  setWebSocketClient,
} from './shared/ws/client';
import pluginManager from './shared/plugin/manager/client';
import App from './shared/renderer/App';

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const MAX_SCROLL_HISTORY = 50;
const LOADING_DELAY_MS = 150;
const ROOT_KEY = Symbol('__rsk.client__');
const READY_STATES = new Set(['interactive', 'complete']);

// =============================================================================
// INITIALIZATION
// =============================================================================

// Create browser history with configurable basename
const history = createBrowserHistory({
  basename: process.env.PUBLIC_URL || '',
});

// Monkey-patch history to support silent reload on navigation
const originalPush = history.push;
const originalReplace = history.replace;

// Helper to get full URL from path/location
const getNavUrl = (path, state) => {
  if (typeof path === 'string') {
    return history.createHref({ pathname: path, state });
  }
  return history.createHref({ ...path, state: state || path.state });
};

history.push = (path, state) => {
  if (pluginManager.needsReload) {
    window.location.href = getNavUrl(path, state);
    return;
  }
  originalPush.call(history, path, state);
};

history.replace = (path, state) => {
  if (pluginManager.needsReload) {
    window.location.replace(getNavUrl(path, state));
    return;
  }
  originalReplace.call(history, path, state);
};

// Abort controller for request cancellation
let fetchAbortController = new AbortController();

// Create fetch
const fetch = createFetch(window.fetch, {
  signal: fetchAbortController.signal,
});

// eslint-disable-next-line no-underscore-dangle
const { redux: preloadedReduxState = {} } = window.__PRELOADED_STATE__ || {};
// eslint-disable-next-line no-underscore-dangle
delete window.__PRELOADED_STATE__; // avoid memory leaks / exposure

// Initialize Redux store
const store = configureStore(preloadedReduxState, { fetch, history, i18n });

// Create context for React components
const context = {
  store,
  fetch,
  i18n,
  history,
  locale:
    (preloadedReduxState &&
      preloadedReduxState.intl &&
      preloadedReduxState.intl.locale) ||
    DEFAULT_LOCALE,
};

// Synchronize i18n language with preloaded Redux state immediately
if (context.locale && i18n.language !== context.locale) {
  i18n.changeLanguage(context.locale);
}

// =============================================================================
// STATE
// =============================================================================

let currentLocation = history.location;
let unlistenHistory = null;
let cachedViews = null;
let wsClient = null;
let isTransitioning = false;
let transitionAbortController = null;
let hasHydrated = false;
let ReactDOMClient = null;
let visibilityChangeHandler = null;
let scrollHandler = null;
let isDOMReady = READY_STATES.has(document.readyState) && !!document.body;
let hasStarted = false;

const scrollPositionsHistory = {};

// =============================================================================
// UTILITIES: LOGGING
// =============================================================================
function log(message, level = 'log') {
  if (__DEV__) {
    console[level](`[Client] ${message}`);
  }
}

// =============================================================================
// UTILITIES: METADATA
// =============================================================================

function updateMetaTag(name, content, isProperty = false) {
  if (!content) return;
  const attr = isProperty ? 'property' : 'name';
  let meta = document.querySelector(`meta[${attr}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function updateMetadata({ title, description, image, url, type = 'website' }) {
  if (title) {
    document.title = title;
    updateMetaTag('og:title', title, true);
    updateMetaTag('twitter:title', title);
  }
  if (description) {
    updateMetaTag('description', description);
    updateMetaTag('og:description', description, true);
    updateMetaTag('twitter:description', description);
  }
  if (image) {
    updateMetaTag('og:image', image, true);
    updateMetaTag('twitter:image', image);
  }
  if (url) {
    updateMetaTag('og:url', url, true);
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
  if (type) {
    updateMetaTag('og:type', type, true);
  }
}

// =============================================================================
// UTILITIES: SCROLL MANAGEMENT
// =============================================================================

function saveScrollPosition() {
  if (!currentLocation || !currentLocation.key) return;

  scrollPositionsHistory[currentLocation.key] = {
    x: window.pageXOffset,
    y: window.pageYOffset,
    time: Date.now(),
  };

  // Cleanup old entries
  const keys = Object.keys(scrollPositionsHistory);
  if (keys.length > MAX_SCROLL_HISTORY) {
    keys
      .sort(
        (a, b) =>
          scrollPositionsHistory[a].time - scrollPositionsHistory[b].time,
      )
      .slice(0, Math.floor(keys.length * 0.25))
      .forEach(key => delete scrollPositionsHistory[key]);
  }
}

function restoreScrollPosition(location) {
  // Skip scroll restoration if preserveScroll flag is set (e.g., during locale switch)
  if (location.state && location.state.preserveScroll) {
    return;
  }

  if (location.hash) {
    let el;
    try {
      el = document.querySelector(location.hash);
    } catch (e) {
      if (location.hash.startsWith('#')) {
        el = document.getElementById(
          decodeURIComponent(location.hash.slice(1)),
        );
      }
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }
  const pos = scrollPositionsHistory[location.key];
  window.scrollTo((pos && pos.x) || 0, (pos && pos.y) || 0);
}

// =============================================================================
// UTILITIES: NETWORK
// =============================================================================

async function loadViews() {
  if (!cachedViews) {
    cachedViews = (await import('./bootstrap/views')).default({
      pluginManager,
    });
    log('✅ Views initialized');
  }
  return cachedViews;
}

function buildWebSocketUrl(path = '/ws') {
  try {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}${normalizedPath}`;
  } catch {
    return null;
  }
}

// =============================================================================
// REACT RENDERING
// =============================================================================

async function initReactDOMClient() {
  if (ReactDOMClient != null) return ReactDOMClient;
  try {
    ReactDOMClient = await import('react-dom/client');
    if (
      !ReactDOMClient ||
      typeof ReactDOMClient.createRoot !== 'function' ||
      typeof ReactDOMClient.hydrateRoot !== 'function'
    ) {
      const err = new Error('React DOM client not found');
      err.name = 'ReactDOMClientNotFound';
      throw err;
    }

    // Expose ReactDOMClient for plugins (Global Vendors Pattern)
    // Plugins dependent on 'react-dom/client' will use this global
    window.ReactDOMClient = ReactDOMClient;
  } catch {
    ReactDOMClient = false;
  }
  return ReactDOMClient;
}

function renderPage(appElement, container, isInitial) {
  const client = ReactDOMClient;

  if (client) {
    // React 18+
    let root = window[ROOT_KEY];
    if (!root) {
      try {
        root = client.hydrateRoot(container, appElement, {
          onRecoverableError: err =>
            log(`❌ Hydration error: ${err.message}`, 'error'),
        });
        log('✅ Hydrated');
      } catch (err) {
        log(
          `❌ Hydration failed, using client render: ${err.message}`,
          'error',
        );
        root = client.createRoot(container);
        root.render(appElement);
      }
      window[ROOT_KEY] = root;
      hasHydrated = true;
    } else {
      root.render(appElement);
    }
  } else {
    // React 16/17 fallback
    import('react-dom').then(ReactDOM => {
      // eslint-disable-next-line react/no-deprecated
      const method =
        // eslint-disable-next-line react/no-deprecated
        isInitial && !hasHydrated ? ReactDOM.hydrate : ReactDOM.render;
      method(appElement, container);
      if (isInitial) hasHydrated = true;
    });
  }
}

// =============================================================================
// TRANSITION
// =============================================================================

function abortTransition() {
  if (
    transitionAbortController &&
    typeof transitionAbortController.abort === 'function'
  ) {
    transitionAbortController.abort();
  }
  transitionAbortController = null;
  isTransitioning = false;
}

function isChunkLoadError(error) {
  return (
    error &&
    (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk'))
  );
}

function handleTransitionError(error, isInitial, location) {
  log(`❌ Transition error: ${error.message}`, 'error');

  // In development, throw to show full error details
  if (__DEV__) {
    throw error;
  }

  // Production: reload on initial load failure or chunk errors
  if (isInitial || isChunkLoadError(error)) {
    log('🔄 Reloading page to recover...', 'info');
    window.location.reload();
    return;
  }

  // Dispatch error to Redux for error boundary handling
  store.dispatch({
    type: 'TRANSITION_ERROR',
    payload: {
      error: { message: error.message, stack: error.stack },
      location,
      timestamp: Date.now(),
    },
  });
}

async function onLocationChange(location, action) {
  const isInitial = !action;

  // Abort previous transition
  if (isTransitioning) abortTransition();

  transitionAbortController = new AbortController();
  const { signal } = transitionAbortController;
  isTransitioning = true;

  saveScrollPosition();
  if (action === 'PUSH') delete scrollPositionsHistory[location.key];

  store.dispatch({ type: 'TRANSITION_START', payload: { location, action } });

  const loadingTimeout = setTimeout(() => {
    store.dispatch({ type: 'TRANSITION_LOADING', payload: true });
  }, LOADING_DELAY_MS);

  currentLocation = location;

  try {
    if (signal.aborted) return;

    // Parse pathname
    context.pathname = history.location.pathname;

    // Parse query params
    context.query = Object.fromEntries(
      new URLSearchParams(history.location.search),
    );

    // Sync locale from Redux state to context
    // This ensures locale changes are reflected in page actions (e.g., loading locale-specific content)
    const currentState = store.getState();
    context.locale =
      (currentState.intl && currentState.intl.locale) || context.locale;

    const views = await loadViews();
    const page = await views.resolve(context);
    if (!page) {
      const err = new Error(`Page ${location.pathname} not found`);
      err.name = 'PageNotFound';
      err.status = 404;
      throw err;
    }

    if (signal.aborted || currentLocation.key !== location.key) return;

    if (page.redirect) {
      history.push(page.redirect);
      return;
    }

    store.dispatch({
      type: 'TRANSITION_SUCCESS',
      payload: { page, location, action },
    });

    const container = document.getElementById('app');
    if (!container) {
      log('❌ Root element #app not found', 'error');
      return;
    }

    const appElement = <App context={context}>{page.component}</App>;
    renderPage(appElement, container, isInitial);

    if (page.title || page.description) {
      updateMetadata({
        title: page.title,
        description: page.description,
        url: window.location.href,
      });
    }

    requestAnimationFrame(() => restoreScrollPosition(location));
  } catch (error) {
    if (!signal.aborted) {
      handleTransitionError(error, isInitial, location);
    }
  } finally {
    clearTimeout(loadingTimeout);
    store.dispatch({ type: 'TRANSITION_LOADING', payload: false });
    isTransitioning = false;
    transitionAbortController = null;
  }
}

// =============================================================================
// LIFECYCLE
// =============================================================================

const safeCleanup = (name, fn) => {
  try {
    fn();
  } catch (err) {
    log(`  ❌ ${name} failed: ${err.message}`, 'error');
  }
};

function cleanup() {
  // Save scroll position before cleanup
  safeCleanup('Save scroll position', saveScrollPosition);

  // Unsubscribe from history events
  safeCleanup('Unsubscribe from history', () => {
    if (typeof unlistenHistory === 'function') {
      unlistenHistory();
    }
    unlistenHistory = null;
  });

  // Abort any ongoing transition
  safeCleanup('Abort transition', () => {
    abortTransition();
  });

  // Dispose WebSocket client (removes all event listeners)
  safeCleanup('Dispose WebSocket', () => {
    if (wsClient && typeof wsClient.dispose === 'function') {
      wsClient.dispose();
    }
    wsClient = null;
    setWebSocketClient(null);
  });

  // Remove event listeners
  safeCleanup('Remove beforeunload listener', () => {
    window.removeEventListener('beforeunload', cleanup);
  });

  safeCleanup('Remove scroll listener', () => {
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler, { passive: true });
      scrollHandler = null;
    }
  });

  // Remove visibility change listener
  safeCleanup('Remove visibility change listener', () => {
    if (visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      visibilityChangeHandler = null;
    }
  });

  // Abort any ongoing requests
  safeCleanup('Abort fetch requests', () => {
    if (fetchAbortController) {
      fetchAbortController.abort();
      fetchAbortController = null;
    }
  });

  log('✅ Cleanup completed', 'info');
}

async function initializeApp() {
  // Initialize React DOM client
  await initReactDOMClient();

  currentLocation = history.location;

  window.addEventListener('beforeunload', cleanup);

  // Debounced scroll tracking
  let scrollTimeout;
  scrollHandler = () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(saveScrollPosition, 100);
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });

  // WebSocket
  try {
    const wsUrl = buildWebSocketUrl();
    if (wsUrl) {
      wsClient = createWebSocketClient({ url: wsUrl, autoReconnect: true });

      // Listen for connection events
      wsClient.on(MessageType.WELCOME, data => {
        log(`✅ WebSocket connected: ${data && data.connectionId}`);
      });

      wsClient.on(EventType.AUTHENTICATED, user => {
        log(`✅ WebSocket authenticated as: ${user && user.id}`);
      });

      wsClient.on(EventType.DISCONNECTED, info => {
        log(`🔌 WebSocket disconnected: ${info}`, 'warn');
      });

      wsClient.on(EventType.RECONNECTING, attempt => {
        log(`🔄 WebSocket reconnecting (attempt ${attempt})`, 'warn');
      });

      wsClient.on('error', error => {
        log(`⚠️ WebSocket error: ${error}`, 'error');
      });

      wsClient.on('plugin:updated', event => {
        pluginManager.handleEvent(event);
      });

      wsClient.connect();
    }
  } catch (error) {
    log(`❌ WebSocket init failed: ${error}`, 'error');
  }

  log('🚀 App initialized');

  // Handle initial page load first
  await onLocationChange(currentLocation);

  // Subscribe to history AFTER initial render to avoid duplicate triggers
  unlistenHistory = history.listen(onLocationChange);

  // Session restoration on tab visibility change:
  // When user returns to tab, check if session is still valid
  // Just refreshes tokens - fresh user data will be fetched on next navigation
  visibilityChangeHandler = async () => {
    // Only check when tab becomes visible and user was authenticated
    if (document.visibilityState !== 'visible') return;
    if (!isAuthenticated(store.getState())) return;

    try {
      // Refresh tokens silently - unwrap() throws if rejected
      await store.dispatch(refreshToken()).unwrap();
    } catch {
      // Refresh explicitly failed - session is truly expired
      await store.dispatch(logout());
      log('⚠️ Session expired while away', 'warn');
    }
  };
  document.addEventListener('visibilitychange', visibilityChangeHandler);
}

// =============================================================================
// STARTUP
// =============================================================================

async function attemptStartup() {
  if (hasStarted || !isDOMReady) return;
  hasStarted = true;
  log('✅ Starting app...');

  // Initialize plugins (Client Side)
  try {
    await pluginManager.init({ ...context });
  } catch (error) {
    console.error('⚠️ Plugin initialization failed:', error.message);
    // Continue app startup even if plugins fail
  }

  // Initialize app
  await initializeApp();
}

if (isDOMReady) {
  attemptStartup();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    isDOMReady = true;
    attemptStartup();
  });
}

// =============================================================================
// HMR
// =============================================================================

if (module.hot) {
  module.hot.accept(err => {
    if (err) {
      log(`❌ HMR error: ${err.message}`, 'error');
      return;
    }
    cachedViews = null;
    const loc = { ...currentLocation };
    const schedule = window.requestIdleCallback || setTimeout;
    schedule(
      () => {
        if (currentLocation.pathname === loc.pathname) {
          onLocationChange(loc, 'HMR_UPDATE');
        }
      },
      { timeout: 1000 },
    );
  });

  module.hot.addStatusHandler(status => {
    if (
      status === 'idle' &&
      // eslint-disable-next-line no-underscore-dangle
      window.__webpack_hot_middleware_reporter__ &&
      // eslint-disable-next-line no-underscore-dangle
      typeof window.__webpack_hot_middleware_reporter__.success === 'function'
    ) {
      // eslint-disable-next-line no-underscore-dangle
      window.__webpack_hot_middleware_reporter__.success();
    }
  });

  module.hot.dispose(() => {
    log('🔥 HMR dispose', 'info');
    cleanup();
  });
}
