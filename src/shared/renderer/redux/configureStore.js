/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  configureStore as createStore,
  combineReducers,
} from '@reduxjs/toolkit';
import rootReducer from './rootReducer';

// Check if running on server
const isServer = typeof window === 'undefined';

/**
 * Symbol to mark identity reducers created for SSR state preservation
 * @private
 */
const IDENTITY_REDUCER = Symbol('__rsk.identityReducer__');

/**
 * Validates reducer injection parameters
 * @private
 * @param {string} key - Reducer key
 * @param {Function} reducer - Reducer function
 * @throws {Error} If validation fails
 */
function validateReducerInjection(key, reducer) {
  if (!key || typeof key !== 'string') {
    const error = new Error(
      '[Redux] injectReducer: key must be a non-empty string',
    );
    error.name = 'ReduxInjectionError';
    throw error;
  }

  if (typeof reducer !== 'function') {
    const error = new Error(
      '[Redux] injectReducer: reducer must be a function',
    );
    error.name = 'ReduxInjectionError';
    throw error;
  }

  // Check for reserved/protected keys
  if (key.startsWith('@@') || key.startsWith('__')) {
    const error = new Error(
      `[Redux] injectReducer: key "${key}" is reserved and cannot be used`,
    );
    error.name = 'ReduxInjectionError';
    throw error;
  }
}

/**
 * Creates an identity reducer that preserves SSR state.
 * Marked with IDENTITY_REDUCER symbol for later detection.
 * @private
 * @param {*} ssrState - Initial state from SSR
 * @returns {Function} Identity reducer function
 */
function createIdentityReducer(ssrState) {
  const identityReducer = (state = ssrState) => state;
  // Mark as identity reducer for detection during injection
  identityReducer[IDENTITY_REDUCER] = true;
  return identityReducer;
}

/**
 * Separates initial state into known (root) and dynamic (to be injected) state
 * @private
 * @param {Object} initialState - Complete initial state
 * @param {string[]} rootReducerKeys - Keys of static root reducers
 * @returns {Object} Object with filteredInitialState and pendingDynamicState
 */
function separateInitialState(initialState, rootReducerKeys) {
  const filteredInitialState = {};
  const pendingDynamicState = {};

  Object.keys(initialState).forEach(key => {
    if (rootReducerKeys.includes(key)) {
      filteredInitialState[key] = initialState[key];
    } else {
      pendingDynamicState[key] = initialState[key];
    }
  });

  return { filteredInitialState, pendingDynamicState };
}

/**
 * Configure and create Redux store using Redux Toolkit
 * @param {Object} initialState - Initial Redux state
 * @param {Object} helpersConfig - Extra argument for thunk middleware
 * @param {Function} helpersConfig.fetch - Isomorphic fetch function
 * @param {Object} helpersConfig.history - History instance (memory on server, browser on client)
 * @param {Object} helpersConfig.i18n - i18next instance
 * @returns {Store} Configured Redux store with dynamic reducer injection
 */
export default function configureStore(initialState = {}, helpersConfig = {}) {
  // Track dynamically injected reducers
  const injectedReducers = {};

  // Track reducer injection listeners for cleanup
  const reducerListeners = new Set();

  // Get known root reducer keys
  const rootReducerKeys = Object.keys(rootReducer);

  // Separate initial state into known (root) and dynamic (to be injected) state
  const { filteredInitialState, pendingDynamicState } = separateInitialState(
    initialState,
    rootReducerKeys,
  );

  /**
   * Configure middleware array
   * @private
   */
  const createMiddleware = getDefaultMiddleware => {
    const middleware = getDefaultMiddleware({
      thunk: {
        extraArgument: helpersConfig,
      },
      // Disable serializable check for i18n instance and other non-serializable data
      serializableCheck: false,
      // Enable immutability check in development
      immutableCheck: __DEV__,
    });

    // Add Redux Logger in development (should be last middleware)
    if (__DEV__) {
      try {
        const { createLogger } = require('redux-logger');
        middleware.push(
          createLogger({
            collapsed: true,
            duration: true,
            timestamp: false,
            diff: false,
            // Predicate to avoid logging specific actions
            predicate: (getState, action) => {
              // Skip logging actions that are too verbose
              const skipActions = ['@@INIT', '@@redux/INIT'];
              return !skipActions.includes(action.type);
            },
            ...(isServer
              ? {
                  // Minimal logging on server:
                  // 1. No colors to avoid escape codes in text logs
                  colors: false,
                  // 2. Hide state to reduce noise (only show actions)
                  stateTransformer: () => null,
                }
              : {}),
          }),
        );
      } catch (err) {
        console.warn('Redux Logger not available:', err.message);
      }
    }

    return middleware;
  };

  // Create store with RTK's configureStore
  const store = createStore({
    reducer: combineReducers(rootReducer),
    preloadedState: filteredInitialState,
    middleware: createMiddleware,
    devTools: __DEV__
      ? {
          trace: true,
          traceLimit: 25,
          // Add action sanitizer to prevent large payloads in DevTools
          actionSanitizer: action => {
            if (action.type === 'FILE_UPLOAD' && action.payload) {
              return {
                ...action,
                payload: '<<FILE_CONTENT>>',
              };
            }
            return action;
          },
        }
      : false,
    // Enhanced production settings
    enhancers: getDefaultEnhancers => {
      return getDefaultEnhancers({
        autoBatch: true,
      });
    },
  });

  /**
   * Rebuilds the root reducer with all current reducers
   * @private
   * @returns {Function} Combined reducer
   */
  const rebuildRootReducer = () =>
    combineReducers({
      ...rootReducer,
      ...injectedReducers,
    });

  /**
   * Notifies all reducer listeners about an injection event
   * @private
   * @param {string} key - Reducer key
   * @param {string} action - Action type (injected, replaced, etc.)
   */
  const notifyReducerListeners = (key, action) =>
    reducerListeners.forEach(listener => {
      try {
        listener({ key, action, timestamp: Date.now() });
      } catch (err) {
        console.error('[Redux] Reducer listener error:', err);
      }
    });

  /**
   * Injects a reducer into the store dynamically.
   * Used by modules to register their Redux slices at runtime.
   * Allows replacing identity reducers (created for SSR state) with real reducers.
   * @param {string} key - Reducer key in state
   * @param {Function} reducer - Reducer function
   * @param {Object} options - Injection options
   * @param {boolean} options.force - Force re-injection even if reducer exists
   * @param {boolean} options.silent - Suppress logging
   * @returns {boolean} True if injection was successful
   */
  store.injectReducer = (key, reducer, options = {}) => {
    try {
      validateReducerInjection(key, reducer);

      const existingReducer = injectedReducers[key];
      const isIdentityReducer =
        existingReducer && existingReducer[IDENTITY_REDUCER] === true;

      // Check if reducer is in root reducers
      if (rootReducerKeys.includes(key)) {
        const error = new Error(
          `[Redux] injectReducer: key "${key}" conflicts with root reducer`,
        );
        error.name = 'ReduxInjectionError';
        throw error;
      }

      // Skip injection if:
      // 1. Reducer already exists
      // 2. It's not an identity reducer
      // 3. Force option is not set
      if (existingReducer && !isIdentityReducer && !options.force) {
        if (__DEV__ && !isServer && !options.silent) {
          console.log(`[Redux] Reducer already injected: ${key}`);
        }
        return false;
      }

      // Inject the reducer
      injectedReducers[key] = reducer;

      // Rebuild the root reducer with injected reducers
      store.replaceReducer(rebuildRootReducer());

      // Determine action type for logging
      let action = 'injected';
      if (isIdentityReducer) {
        action = 'replaced_identity';
      } else if (options.force) {
        action = 'force_reinjected';
      }

      // Log the injection
      if (__DEV__ && !isServer && !options.silent) {
        const actionLabels = {
          injected: 'Injected',
          replaced_identity: 'Replaced identity',
          force_reinjected: 'Force re-injected',
        };
        console.log(`[Redux] ${actionLabels[action]} reducer: ${key}`);
      }

      // Notify listeners
      notifyReducerListeners(key, action);

      return true;
    } catch (error) {
      if (__DEV__) {
        console.error(error);
      }
      throw error;
    }
  };

  /**
   * Removes a dynamically injected reducer from the store
   * @param {string} key - Reducer key to remove
   * @param {Object} options - Removal options
   * @param {boolean} options.silent - Suppress logging
   * @returns {boolean} True if removal was successful
   */
  store.removeReducer = (key, options = {}) => {
    if (!injectedReducers[key]) {
      if (__DEV__ && !options.silent) {
        console.warn(`[Redux] Cannot remove non-existent reducer: ${key}`);
      }
      return false;
    }

    delete injectedReducers[key];
    store.replaceReducer(rebuildRootReducer());

    if (__DEV__ && !isServer && !options.silent) {
      console.log(`[Redux] Removed reducer: ${key}`);
    }

    notifyReducerListeners(key, 'removed');

    return true;
  };

  /**
   * Batch inject multiple reducers at once for better performance
   * @param {Object} reducers - Object mapping keys to reducer functions
   * @param {Object} options - Injection options
   * @param {boolean} options.force - Force re-injection even if reducer exists
   * @param {boolean} options.silent - Suppress logging
   * @returns {Object} Object with injected keys and skipped keys
   */
  store.batchInjectReducers = (reducers, options = {}) => {
    if (!reducers || typeof reducers !== 'object' || Array.isArray(reducers)) {
      throw new Error(
        '[Redux] batchInjectReducers: reducers must be a plain object',
      );
    }

    const injected = [];
    const skipped = [];
    const errors = {};

    Object.entries(reducers).forEach(([key, reducer]) => {
      try {
        const success = store.injectReducer(key, reducer, {
          ...options,
          silent: true,
        });
        if (success) {
          injected.push(key);
        } else {
          skipped.push(key);
        }
      } catch (err) {
        skipped.push(key);
        errors[key] = err.message;
        if (__DEV__) {
          console.error(`[Redux] Failed to inject reducer "${key}":`, err);
        }
      }
    });

    if (__DEV__ && !isServer && !options.silent) {
      if (injected.length > 0) {
        console.log(`[Redux] Batch injected reducers: ${injected.join(', ')}`);
      }
      if (skipped.length > 0) {
        console.log(`[Redux] Skipped reducers: ${skipped.join(', ')}`);
      }
    }

    return { injected, skipped, errors };
  };

  /**
   * Batch remove multiple reducers at once for better performance
   * @param {string[]} keys - Array of reducer keys to remove
   * @param {Object} options - Removal options
   * @param {boolean} options.silent - Suppress logging
   * @returns {Object} Object with removed keys and notFound keys
   */
  store.batchRemoveReducers = (keys, options = {}) => {
    if (!Array.isArray(keys)) {
      throw new Error('[Redux] batchRemoveReducers: keys must be an array');
    }

    const removed = [];
    const notFound = [];
    let needsRebuild = false;

    // First pass: validate and mark for removal
    keys.forEach(key => {
      if (!injectedReducers[key]) {
        notFound.push(key);
        if (__DEV__ && !options.silent) {
          console.warn(`[Redux] Cannot remove non-existent reducer: ${key}`);
        }
      } else {
        delete injectedReducers[key];
        removed.push(key);
        needsRebuild = true;
      }
    });

    // Rebuild reducer only once if any removals occurred
    if (needsRebuild) {
      store.replaceReducer(rebuildRootReducer());

      if (__DEV__ && !isServer && !options.silent) {
        console.log(`[Redux] Batch removed reducers: ${removed.join(', ')}`);
      }

      // Notify listeners for each removed reducer
      removed.forEach(key => {
        notifyReducerListeners(key, 'removed');
      });
    }

    return { removed, notFound };
  };

  /**
   * Gets all dynamically injected reducer keys.
   * @returns {string[]} Array of injected reducer keys
   */
  store.getInjectedReducers = () => Object.keys(injectedReducers);

  /**
   * Checks if a reducer is injected.
   * @param {string} key - Reducer key
   * @returns {boolean} True if reducer is injected
   */
  store.hasReducer = key => key in injectedReducers;

  /**
   * Checks if a reducer is an identity reducer.
   * @param {string} key - Reducer key
   * @returns {boolean} True if reducer is an identity reducer
   */
  store.isIdentityReducer = key => {
    const reducer = injectedReducers[key];
    return reducer && reducer[IDENTITY_REDUCER] === true;
  };

  /**
   * Registers a listener to be called when reducers are injected or removed
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  store.onReducerChange = listener => {
    if (typeof listener !== 'function') {
      throw new Error('[Redux] onReducerChange: listener must be a function');
    }

    reducerListeners.add(listener);

    // Return unsubscribe function
    return () => {
      reducerListeners.delete(listener);
    };
  };

  /**
   * Gets store statistics for debugging
   * @returns {Object} Store statistics
   */
  store.getStats = () => ({
    rootReducers: rootReducerKeys.length,
    injectedReducers: Object.keys(injectedReducers).length,
    identityReducers: Object.keys(injectedReducers).filter(key =>
      store.isIdentityReducer(key),
    ).length,
    listeners: reducerListeners.size,
  });

  // Pre-populate injected reducers with identity reducers for pending SSR state
  // This allows dynamic reducers to seamlessly take over the SSR state
  Object.keys(pendingDynamicState).forEach(key => {
    injectedReducers[key] = createIdentityReducer(pendingDynamicState[key]);
  });

  // If there's pending dynamic state, immediately replace the reducer to include it
  if (Object.keys(pendingDynamicState).length > 0) {
    store.replaceReducer(rebuildRootReducer());

    if (__DEV__ && !isServer) {
      console.log(
        `[Redux] Pre-loaded SSR state for: ${Object.keys(pendingDynamicState).join(', ')}`,
      );
    }
  }

  // Cleanup function for server-side rendering
  if (isServer) {
    store.close = () => {
      reducerListeners.clear();
    };
  }

  return store;
}

/**
 * Type definitions for TypeScript users (JSDoc format)
 * @typedef {Object} StoreWithInjection
 * @property {Function} injectReducer - Inject a reducer dynamically
 * @property {Function} removeReducer - Remove an injected reducer
 * @property {Function} batchInjectReducers - Inject multiple reducers at once
 * @property {Function} batchRemoveReducers - Remove multiple reducers at once
 * @property {Function} getInjectedReducers - Get all injected reducer keys
 * @property {Function} hasReducer - Check if a reducer is injected
 * @property {Function} isIdentityReducer - Check if a reducer is an identity reducer
 * @property {Function} onReducerChange - Listen to reducer injection events
 * @property {Function} getStats - Get store statistics
 * @property {Function} [close] - Cleanup function (server-side only)
 */
