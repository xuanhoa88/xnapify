/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'url-polyfill';
import 'whatwg-fetch';
import { createBrowserHistory } from 'history';
import { createFetch } from '@shared/fetch';
import {
  configureStore,
  refreshToken,
  logout,
  isAuthenticated,
} from '@shared/renderer/redux';
import i18n, { DEFAULT_LOCALE } from '@shared/i18n';
import {
  createWebSocketClient,
  EventType,
  MessageType,
  setWebSocketClient,
} from '@shared/ws/client';
import pluginManager from '@shared/plugin/client';
import { Container } from '@shared/container';
import App from '@shared/renderer/App';

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const MAX_SCROLL_HISTORY = 50;
const LOADING_DELAY_MS = 150;
const READY_STATES = new Set(['interactive', 'complete']);
const WS_MAX_FAILURES = 5;
const REACT_DOM_UNAVAILABLE = false;

// =============================================================================
// INITIALIZATION
// =============================================================================

// Create dependency injection container
const container = new Container();

// eslint-disable-next-line no-underscore-dangle
const preloadedState = window.__PRELOADED_STATE__ || {};

// Create browser history with configurable basename
let parsedBasename = '';
try {
  const appUrlStr =
    process.env.RSK_APP_URL || window.appUrl || preloadedState.appUrl || '';
  if (appUrlStr.startsWith('http')) {
    parsedBasename = new URL(appUrlStr).pathname;
    if (parsedBasename === '/') parsedBasename = '';
  } else {
    parsedBasename = appUrlStr;
  }
} catch {
  parsedBasename = '';
}
const history = createBrowserHistory({ basename: parsedBasename });

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

const { redux: preloadedReduxState = {} } = preloadedState;
// eslint-disable-next-line no-underscore-dangle
delete window.__PRELOADED_STATE__; // avoid memory leaks / exposure

// Initialize Redux store
const store = configureStore(preloadedReduxState, { fetch, history, i18n });

// Create context for React components
const context = {
  container,
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
let root = null;
let visibilityChangeHandler = null;
let scrollHandler = null;
let isDOMReady = READY_STATES.has(document.readyState) && !!document.body;
let hasStarted = false;
let isRefreshingToken = false;
let wsConnectionFailures = 0;

const scrollPositionsHistory = new Map();

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

function createScrollHandler() {
  let scrollTimeout = null;

  return () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      saveScrollPosition();
      scrollTimeout = null;
    }, 100);
  };
}

function saveScrollPosition() {
  if (!currentLocation || !currentLocation.key) return;

  // Delete first so re-insertion moves the key to the end (most recent)
  scrollPositionsHistory.delete(currentLocation.key);
  scrollPositionsHistory.set(currentLocation.key, {
    x: window.pageXOffset,
    y: window.pageYOffset,
  });

  // Evict oldest entries (Map iterates in insertion order)
  while (scrollPositionsHistory.size > MAX_SCROLL_HISTORY) {
    const oldestKey = scrollPositionsHistory.keys().next().value;
    scrollPositionsHistory.delete(oldestKey);
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
  const pos = scrollPositionsHistory.get(location.key);
  window.scrollTo((pos && pos.x) || 0, (pos && pos.y) || 0);
}

// =============================================================================
// UTILITIES: NETWORK
// =============================================================================

async function initializeViews() {
  if (!cachedViews) {
    cachedViews = import('./bootstrap/views')
      .then(m => {
        const views = m.default({ plugin: pluginManager, container });
        log('✅ Views initialized');
        return views;
      })
      .catch(err => {
        cachedViews = null; // allow retry on failure
        log('❌ Failed to load views:' + err.message, 'error');
        throw err;
      });
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
  if (ReactDOMClient != null) return ReactDOMClient; // includes REACT_DOM_UNAVAILABLE
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
    ReactDOMClient = REACT_DOM_UNAVAILABLE;
  }
  return ReactDOMClient;
}

async function renderLegacy(appElement, container, isInitial) {
  let ReactDOM;

  try {
    ReactDOM = await import('react-dom');
  } catch (err) {
    log(`❌ Failed to load react-dom: ${err.message}`, 'error');
    if (__DEV__) {
      throw err;
    }
    return;
  }

  if (isInitial && !hasHydrated) {
    try {
      // eslint-disable-next-line react/no-deprecated
      ReactDOM.hydrate(appElement, container);
      hasHydrated = true;
      log('✅ Hydrated (React 16/17)');
    } catch (err) {
      log(
        `❌ Legacy hydration failed, falling back to render: ${err.message}`,
        'error',
      );
      // eslint-disable-next-line react/no-deprecated
      ReactDOM.render(appElement, container);
    }
  } else {
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.render(appElement, container);
  }
}

function renderReact18(appElement, container, isInitial) {
  if (root) {
    // Subsequent render — just update the existing root.
    root.render(appElement);
    return;
  }

  if (isInitial && !hasHydrated) {
    try {
      root = ReactDOMClient.hydrateRoot(container, appElement, {
        onRecoverableError: err =>
          log(`❌ Hydration error: ${err.message}`, 'error'),
      });
      hasHydrated = true;
      log('✅ Hydrated (React 18)');
    } catch (err) {
      log(
        `❌ Hydration failed, falling back to client render: ${err.message}`,
        'error',
      );
      root = ReactDOMClient.createRoot(container);
      root.render(appElement);
      // hasHydrated intentionally left false — SSR content was not reused.
    }
  } else {
    root = ReactDOMClient.createRoot(container);
    root.render(appElement);
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
  if (action === 'PUSH') scrollPositionsHistory.delete(location.key);

  store.dispatch({ type: 'TRANSITION_START', payload: { location, action } });

  const loadingTimeout = setTimeout(() => {
    store.dispatch({ type: 'TRANSITION_LOADING', payload: true });
  }, LOADING_DELAY_MS);

  currentLocation = location;

  try {
    if (signal.aborted) return;

    // Build per-transition context to avoid mutating the shared object
    const currentState = store.getState();
    const transitionContext = {
      ...context,
      pathname: history.location.pathname,
      query: Object.fromEntries(new URLSearchParams(history.location.search)),
      // Sync locale from Redux state
      locale: (currentState.intl && currentState.intl.locale) || context.locale,
    };

    const views = await initializeViews();
    const page = await views.resolve(transitionContext);
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

    const appContainer = document.getElementById('app');
    if (!appContainer) {
      log('❌ Root element #app not found', 'error');
      return;
    }

    const appElement = <App context={transitionContext}>{page.component}</App>;
    if (ReactDOMClient) {
      renderReact18(appElement, appContainer, isInitial);
    } else {
      await renderLegacy(appElement, appContainer, isInitial);
    }

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
      // Only nullify if this is a final cleanup (not HMR).
      // HMR dispose calls cleanup(), but the signal was already captured by createFetch.
      // Nullifying here would break subsequent fetches after HMR re-init.
    }
  });

  // Clear scroll positions history
  safeCleanup('Clear scroll positions history', () => {
    scrollPositionsHistory.clear();
  });

  log('✅ Cleanup completed', 'info');
}

async function initializeApp() {
  // Initialize React DOM client
  await initReactDOMClient();

  currentLocation = history.location;

  window.addEventListener('beforeunload', cleanup);

  // Debounced scroll tracking
  scrollHandler = createScrollHandler();
  window.addEventListener('scroll', scrollHandler, { passive: true });

  // WebSocket
  try {
    const wsUrl = buildWebSocketUrl();
    if (wsUrl) {
      wsClient = createWebSocketClient({ url: wsUrl, autoReconnect: true });

      // Listen for connection events
      wsClient.on(MessageType.WELCOME, data => {
        wsConnectionFailures = 0; // Reset on successful connection
        log(`✅ WebSocket connected: ${data && data.connectionId}`);
      });

      wsClient.on(EventType.AUTHENTICATED, user => {
        log(`✅ WebSocket authenticated as: ${user && user.id}`);
      });

      wsClient.on(EventType.DISCONNECTED, info => {
        wsConnectionFailures++;
        log(
          `🔌 WebSocket disconnected (${wsConnectionFailures}/${WS_MAX_FAILURES}): ${info}`,
          'warn',
        );

        if (wsConnectionFailures >= WS_MAX_FAILURES) {
          store.dispatch({
            type: 'WS_UNAVAILABLE',
            payload: { retries: wsConnectionFailures },
          });
          log('⚠️ WebSocket unavailable after multiple attempts', 'error');
        }
      });

      wsClient.on(EventType.RECONNECTING, attempt => {
        log(`🔄 WebSocket reconnecting (attempt ${attempt})`, 'warn');
      });

      wsClient.on('error', error => {
        log(`⚠️ WebSocket error: ${error}`, 'error');
      });

      // Add a pending flag to prevent concurrent processing
      let pendingPluginUpdate = null;
      wsClient.on('plugin:updated', event => {
        if (pendingPluginUpdate) return; // Skip if already processing
        pendingPluginUpdate = (async () => {
          try {
            await pluginManager.handleEvent(event);
          } finally {
            pendingPluginUpdate = null;
          }
        })();
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
    if (document.visibilityState !== 'visible') return;
    if (!isAuthenticated(store.getState())) return;
    if (isRefreshingToken) return; // Guard against concurrent refreshes

    isRefreshingToken = true;
    try {
      // Add timeout to prevent hanging
      const refreshAction = store.dispatch(refreshToken());
      let timeoutId;
      await Promise.race([
        refreshAction.unwrap(),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            if (refreshAction.abort) refreshAction.abort();
            const err = new Error('Token refresh timeout');
            err.name = 'TokenRefreshTimeoutError';
            err.code = 'TOKEN_REFRESH_TIMEOUT';
            reject(err);
          }, 5_000);
        }),
      ]).finally(() => clearTimeout(timeoutId));
    } catch (err) {
      log(`⚠️ Token refresh failed: ${err.message}`, 'warn');
      await store.dispatch(logout());
    } finally {
      isRefreshingToken = false;
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
    log(`⚠️ Plugin initialization failed: ${error.message}`, 'error');
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

  // Listen for plugin rebuild events from dev server via hot middleware
  const RELOAD_PENDING = Symbol.for('__rsk.hmrPluginReloadPending__');
  let hmrEventSource = null;
  let isHmrInitialized = false;

  // Initialize HMR
  (() => {
    if (isHmrInitialized) return;
    isHmrInitialized = true;

    if (
      // eslint-disable-next-line no-underscore-dangle
      window.__webpack_hot_middleware_reporter__ &&
      typeof EventSource !== 'undefined'
    ) {
      hmrEventSource = new EventSource('/~/__webpack_hmr');

      hmrEventSource.onerror = () => {
        log('⚠️ HMR EventSource connection error', 'warn');
      };

      const handleMessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'plugins-refreshed') {
            log('🔌 Plugin(s) rebuilt, reload required');

            // Ensure next navigation triggers a full page reload
            pluginManager.needsReload = true;

            // Show only one confirm at a time and debounce
            if (window[RELOAD_PENDING]) return;
            window[RELOAD_PENDING] = true;

            setTimeout(() => {
              // Ask user if they want to reload now
              // eslint-disable-next-line no-alert
              if (
                window.confirm(
                  'Plugin(s) updated. Reload now to apply changes?',
                )
              ) {
                window.location.reload();
              } else {
                // Cooldown to prevent spamming if canceled
                setTimeout(() => {
                  window[RELOAD_PENDING] = false;
                }, 3000);
              }
            }, 100);
          }
        } catch (e) {
          // Ignore non-JSON
        }
      };

      hmrEventSource.addEventListener('message', handleMessage);
    }
  })();

  // Handle HMR status updates
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
    if (hmrEventSource) {
      hmrEventSource.close();
      hmrEventSource = null;
    }
    isHmrInitialized = false;
    cleanup();
  });
}
