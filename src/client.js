/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { startTransition } from 'react';

import { createBrowserHistory } from 'history';
import merge from 'lodash/merge';

import { Container } from '@shared/container/index.js';
import extensionManager from '@shared/extension/client/index.js';
import { createFetch } from '@shared/fetch/index.js';
import i18n, { DEFAULT_LOCALE } from '@shared/i18n/index.js';
import App from '@shared/renderer/App.js';
import { configureStore, features } from '@shared/renderer/redux/index.js';
const { refreshToken, logout, isAuthenticated } = features;
import {
  createWebSocketClient,
  EventType,
  MessageType,
  setWebSocketClient,
} from '@shared/ws/client/index.js';

const hotAPI =
  import.meta.webpackHot || (typeof module !== 'undefined' && module.hot);

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const MAX_SCROLL_HISTORY = 50;
const LOADING_DELAY_MS = 150;
const READY_STATES = new Set(['interactive', 'complete']);
const WS_MAX_FAILURES = 5;

// =============================================================================
// INITIALIZATION
// =============================================================================

let preloadedState;
if (hotAPI && hotAPI.data && hotAPI.data.reduxState) {
  preloadedState = { redux: hotAPI.data.reduxState };
} else {
  // eslint-disable-next-line no-underscore-dangle
  preloadedState = merge({}, window.__PRELOADED_STATE__);
  // eslint-disable-next-line no-underscore-dangle
  delete window.__PRELOADED_STATE__; // avoid memory leaks / exposure
}

const { redux: preloadedReduxState = {} } = preloadedState;

// Create browser history (history v5 removed basename option)
const history = createBrowserHistory();

// Abort controller for request cancellation
let fetchAbortController = new AbortController();

// Create fetch
const fetch = createFetch(window.fetch, {
  signal: fetchAbortController.signal,
});

// Initialize Redux store
const store = configureStore(preloadedReduxState, { fetch, history, i18n });

// Create context for React components
const context = {
  store,
  fetch,
  i18n,
  history,
  container: new Container(),
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

// HMR State
let isExtensionReloadPending =
  (hotAPI && hotAPI.data && hotAPI.data.extensionReloadPending) || false;

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
  const attr = isProperty ? 'property' : 'name';
  let meta = document.querySelector(`meta[${attr}="${name}"]`);

  // Remove stale tags when navigating to a page without them
  if (!content) {
    if (meta) {
      meta.remove();
    }
    return;
  }

  // Create new tag if it doesn't exist
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', content);
}

function updateMetadata({ title, description, image, url, type = 'website' }) {
  // Title
  if (title) {
    document.title = title;
    updateMetaTag('og:title', title, true);
    updateMetaTag('twitter:title', title);
  }

  // Description
  updateMetaTag('description', description);
  updateMetaTag('og:description', description, true);
  updateMetaTag('twitter:description', description);

  // Image
  updateMetaTag('og:image', image, true);
  updateMetaTag('twitter:image', image);

  // Type
  updateMetaTag('og:type', type, true);

  // Canonical URL
  updateMetaTag('og:url', url, true);

  let link = document.querySelector('link[rel="canonical"]');
  if (url) {
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  } else if (link) {
    link.remove();
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
    cachedViews = import('./bootstrap/views.js')
      .then(m => {
        const views = m.default(context, extensionManager);
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
  if (ReactDOMClient != null) return ReactDOMClient;
  try {
    const rawModule = await import('react-dom/client');
    ReactDOMClient = rawModule.default || rawModule;
    if (
      !ReactDOMClient ||
      typeof ReactDOMClient.createRoot !== 'function' ||
      typeof ReactDOMClient.hydrateRoot !== 'function'
    ) {
      const err = new Error('React DOM client not found');
      err.name = 'ReactDOMClientNotFound';
      throw err;
    }

    // Expose ReactDOMClient for extensions (Global Vendors Pattern)
    // Extensions dependent on 'react-dom/client' will use this global
    window.ReactDOMClient = ReactDOMClient;
  } catch (err) {
    log(`❌ Failed to load react-dom/client: ${err.message}`, 'error');
    throw err;
  }
  return ReactDOMClient;
}

function renderApp(appElement, container, isInitial) {
  if (root) {
    // Subsequent render — just update the existing root.
    startTransition(() => {
      root.render(appElement);
    });
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
    renderApp(appElement, appContainer, isInitial);

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

  // Unmount React root so createRoot() can re-attach on HMR re-init
  safeCleanup('Unmount React root', () => {
    if (root && typeof root.unmount === 'function') {
      root.unmount();
    }
    root = null;
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

      // Sequential queue — process events in order, never drop any
      let extensionEventQueue = Promise.resolve();
      wsClient.on('extension:updated', event => {
        extensionEventQueue = extensionEventQueue.then(async () => {
          try {
            await extensionManager.processLifecycleEvent(event);
          } catch (err) {
            log(`⚠️ Extension event failed: ${err.message}`, 'error');
          }
        });
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
  unlistenHistory = history.listen(({ location: loc, action: act }) =>
    startTransition(() => {
      onLocationChange(loc, act);
    }),
  );

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

  // Phase 1: Initialize extension manager (setup only, no sync)
  extensionManager.viewContainer = context.container;
  extensionManager.fetch = fetch;

  // Phase 1b: Load active extensions (API is already reachable on the client)
  try {
    await extensionManager.sync(preloadedState.extensions);
  } catch (error) {
    log(`⚠️ Extension sync failed: ${error.message}`, 'error');
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

if (hotAPI) {
  hotAPI.accept(() => {
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

  // Listen for extension rebuild events from dev server via hot middleware.
  // Uses the singleton HMR API exposed by hotClient.js to avoid duplicate
  // EventSource connections.
  const hmrUnsubscribers = [];

  // eslint-disable-next-line no-underscore-dangle
  const hmrApi = window.__xnapify_hmr_api__;
  if (hmrApi) {
    // Note: State preservation across reloads is handled via hotAPI.data in the dispose handler
    hmrUnsubscribers.push(
      hmrApi.onError(() => {
        log('⚠️ HMR EventSource connection error', 'warn');
      }),
    );

    hmrUnsubscribers.push(
      hmrApi.subscribe(data => {
        if (data && data.type === 'extensions-refreshed') {
          log('🔌 Extension(s) rebuilt, hot reloading...');

          // Resolve internal extension IDs from manifest names
          const internalIds = (data.extensions || [])
            // eslint-disable-next-line no-underscore-dangle
            .map(name => extensionManager._resolveLoadedId(name))
            .filter(Boolean);

          if (internalIds.length > 0) {
            // eslint-disable-next-line no-underscore-dangle
            extensionManager._refreshExtensions(internalIds).catch(err => {
              log(`⚠️ Extension HMR failed: ${err.message}`, 'error');
            });
          } else {
            // Fallback: reload if we can't resolve the IDs (e.g. new extension added)
            // Show only one confirm at a time and debounce
            if (isExtensionReloadPending) return;
            isExtensionReloadPending = true;

            setTimeout(() => {
              if (
                window.confirm(
                  'New extension(s) detected. Reload now to apply changes?',
                )
              ) {
                window.location.reload();
              } else {
                setTimeout(() => {
                  isExtensionReloadPending = false;
                }, 3000);
              }
            }, 100);
          }
        }
      }),
    );
  }

  hotAPI.dispose(data => {
    log('🔥 HMR dispose', 'info');

    // Save redux state, workspace settings
    if (store) {
      data.reduxState = store.getState();
    }
    data.extensionReloadPending = isExtensionReloadPending;

    // Unsubscribe all HMR listeners to prevent handler leaks across reloads
    hmrUnsubscribers.forEach(unsub => unsub());
    cleanup();
  });
}
