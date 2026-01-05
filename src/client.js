/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'whatwg-fetch';
import { loadableReady } from '@loadable/component';
import { createBrowserHistory } from 'history';
import { createFetch } from './shared/fetch';
import { configureStore, refreshToken, logout, isAuthenticated } from './redux';
import i18n, { DEFAULT_LOCALE } from './shared/i18n';
import {
  createWebSocketClient,
  EventType,
  MessageType,
} from './shared/ws/client';
import App from './shared/renderer/App';

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const MAX_SCROLL_HISTORY = 50;
const LOADING_DELAY_MS = 150;
const ROOT_KEY = Symbol('__rsk.client__');

// =============================================================================
// INITIALIZATION
// =============================================================================

const history = createBrowserHistory({ basename: '' });
const fetch = createFetch(window.fetch);

// eslint-disable-next-line no-underscore-dangle
const { redux: preloadedReduxState = {} } = window.__PRELOADED_STATE__ || {};
// eslint-disable-next-line no-underscore-dangle
delete window.__PRELOADED_STATE__; // avoid memory leaks / exposure
const store = configureStore(preloadedReduxState, { fetch, history, i18n });

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
let unsubscribeNavigation = null;
let cachedNavigator = null;
let wsClient = null;
let isNavigating = false;
let navigationAbortController = null;
let hasHydrated = false;
let ReactDOMClient = null;
let visibilityChangeHandler = null;

const scrollPositionsHistory = {};

// =============================================================================
// METADATA HELPERS
// =============================================================================

function updateMeta(name, content, isProperty = false) {
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

function updatePageMetadata({
  title,
  description,
  image,
  url,
  type = 'website',
}) {
  if (title) {
    document.title = title;
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
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
  if (type) {
    updateMeta('og:type', type, true);
  }
}

// =============================================================================
// SCROLL MANAGEMENT
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
    const el = document.querySelector(location.hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }
  const pos = scrollPositionsHistory[location.key];
  window.scrollTo((pos && pos.x) || 0, (pos && pos.y) || 0);
}

// =============================================================================
// WEBSOCKET
// =============================================================================

function buildWebSocketUrl(path = '/ws') {
  try {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}${normalizedPath}`;
  } catch (error) {
    return null;
  }
}

// =============================================================================
// NAVIGATOR
// =============================================================================

async function getNavigator() {
  if (!cachedNavigator) {
    cachedNavigator = await import('./pages').then(m => m.default());
    if (__DEV__) console.log('✅ Navigator initialized');
  }
  return cachedNavigator;
}

// =============================================================================
// REACT RENDERING
// =============================================================================

async function initReactDOMClient() {
  if (ReactDOMClient !== null) return ReactDOMClient;
  try {
    ReactDOMClient = await import('react-dom/client');
    if (
      !ReactDOMClient ||
      typeof ReactDOMClient.createRoot !== 'function' ||
      typeof ReactDOMClient.hydrateRoot !== 'function'
    ) {
      ReactDOMClient = false;
    }
  } catch {
    ReactDOMClient = false;
  }
  return ReactDOMClient;
}

function renderApp(appElement, container, isInitial) {
  const client = ReactDOMClient;

  if (client) {
    // React 18+
    let root = window[ROOT_KEY];
    if (!root) {
      try {
        root = client.hydrateRoot(container, appElement, {
          onRecoverableError: err =>
            __DEV__ && console.error('Hydration error:', err),
        });
        if (__DEV__) console.log('✅ Hydrated');
      } catch (err) {
        if (__DEV__)
          console.warn('Hydration failed, using client render:', err);
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
// NAVIGATION
// =============================================================================

function abortNavigation() {
  if (
    navigationAbortController &&
    typeof navigationAbortController.abort === 'function'
  ) {
    navigationAbortController.abort();
  }
  navigationAbortController = null;
  isNavigating = false;
}

function handleNavigationError(error, isInitial, location) {
  if (__DEV__) {
    console.error('❌ Navigation error:', error);
    throw error;
  }

  // Production: reload on initial load failure or chunk errors
  if (
    isInitial ||
    (error &&
      (error.name === 'ChunkLoadError' ||
        error.message.includes('Loading chunk')))
  ) {
    console.warn('Navigation error, reloading...');
    window.location.reload();
    return;
  }

  store.dispatch({
    type: 'NAVIGATION_ERROR',
    payload: {
      error: { message: error.message, stack: error.stack },
      location,
      timestamp: Date.now(),
    },
  });
}

async function handlePageChange(location, action) {
  const isInitial = !action;

  // Abort previous navigation
  if (isNavigating) abortNavigation();

  navigationAbortController = new AbortController();
  const { signal } = navigationAbortController;
  isNavigating = true;

  saveScrollPosition();
  if (action === 'PUSH') delete scrollPositionsHistory[location.key];

  store.dispatch({ type: 'NAVIGATION_START', payload: { location, action } });

  const loadingTimeout = setTimeout(() => {
    store.dispatch({ type: 'NAVIGATION_LOADING', payload: true });
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

    const navigator = await getNavigator();
    const page = await navigator.resolve(context);
    if (!page) {
      const err = new Error(`Page ${location.pathname} not found`);
      err.status = 404;
      throw err;
    }

    if (signal.aborted || currentLocation.key !== location.key) return;

    if (page.redirect) {
      history.push(page.redirect);
      return;
    }

    store.dispatch({
      type: 'NAVIGATION_SUCCESS',
      payload: { page, location, action },
    });

    const container = document.getElementById('app');
    if (!container) {
      console.error('Root element #app not found');
      return;
    }

    const appElement = <App context={context}>{page.component}</App>;
    renderApp(appElement, container, isInitial);

    if (page.title || page.description) {
      updatePageMetadata({
        title: page.title,
        description: page.description,
        url: window.location.href,
      });
    }

    requestAnimationFrame(() => restoreScrollPosition(location));
  } catch (error) {
    if (!signal.aborted) {
      handleNavigationError(error, isInitial, location);
    }
  } finally {
    clearTimeout(loadingTimeout);
    store.dispatch({ type: 'NAVIGATION_LOADING', payload: false });
    isNavigating = false;
    navigationAbortController = null;
  }
}

// =============================================================================
// LIFECYCLE
// =============================================================================

function cleanup() {
  // Save scroll position before cleanup
  saveScrollPosition();

  // Unsubscribe from navigation events
  if (typeof unsubscribeNavigation === 'function') {
    unsubscribeNavigation();
  }
  unsubscribeNavigation = null;

  // Abort any ongoing navigation
  abortNavigation();

  // Dispose WebSocket client (removes all event listeners)
  if (wsClient && typeof wsClient.dispose === 'function') {
    wsClient.dispose();
  }
  wsClient = null;

  // Remove event listeners
  window.removeEventListener('beforeunload', cleanup);
  window.removeEventListener('scroll', saveScrollPosition, { passive: true });

  // Remove visibility change listener
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    visibilityChangeHandler = null;
  }

  if (__DEV__) console.log('✅ Cleanup completed');
}

async function initializeApp() {
  // Initialize React DOM client
  await initReactDOMClient();

  currentLocation = history.location;

  window.addEventListener('beforeunload', cleanup);

  // Debounced scroll tracking
  let scrollTimeout;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveScrollPosition, 100);
    },
    { passive: true },
  );

  // WebSocket
  try {
    const wsUrl = buildWebSocketUrl();
    if (wsUrl) {
      wsClient = createWebSocketClient({ url: wsUrl, autoReconnect: true });

      // Listen for connection events
      wsClient.on(MessageType.WELCOME, data => {
        if (__DEV__)
          console.log('✅ WebSocket connected:', data && data.connectionId);
      });

      wsClient.on(EventType.AUTHENTICATED, user => {
        if (__DEV__)
          console.log('✅ WebSocket authenticated as:', user && user.id);
      });

      wsClient.on(EventType.DISCONNECTED, info => {
        if (__DEV__) console.log('🔌 WebSocket disconnected:', info);
      });

      wsClient.on(EventType.RECONNECTING, attempt => {
        if (__DEV__)
          console.log(`🔄 WebSocket reconnecting (attempt ${attempt})`);
      });

      wsClient.on('error', error => {
        if (__DEV__) console.warn('⚠️ WebSocket error:', error);
      });

      wsClient.connect();
    }
  } catch (error) {
    if (__DEV__) console.error('WebSocket init failed:', error);
  }

  if (__DEV__) console.log('🚀 App initialized');

  // Handle initial page load first
  await handlePageChange(currentLocation);

  // Subscribe to navigation AFTER initial render to avoid duplicate triggers
  unsubscribeNavigation = history.listen(handlePageChange);

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
      if (__DEV__) console.log('⚠️ Session expired while away');
    }
  };
  document.addEventListener('visibilitychange', visibilityChangeHandler);
}

// =============================================================================
// STARTUP
// =============================================================================

const READY_STATES = new Set(['interactive', 'complete']);
let isDOMReady = READY_STATES.has(document.readyState) && !!document.body;
let areChunksLoaded = false;
let hasStarted = false;

function attemptStartup() {
  if (hasStarted || !isDOMReady || !areChunksLoaded) return;
  hasStarted = true;
  if (__DEV__) console.log('✅ Starting app...');
  initializeApp();
}

loadableReady(() => {
  areChunksLoaded = true;
  attemptStartup();
});

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
      console.error('❌ HMR error:', err);
      return;
    }
    cachedNavigator = null;
    const loc = { ...currentLocation };
    const schedule = window.requestIdleCallback || setTimeout;
    schedule(
      () => {
        if (currentLocation.pathname === loc.pathname) {
          handlePageChange(loc, 'HMR_UPDATE');
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
    if (__DEV__) console.log('🔥 HMR dispose');
    cleanup();
  });
}
