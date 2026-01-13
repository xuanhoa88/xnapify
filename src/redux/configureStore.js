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

/**
 * Symbol to mark identity reducers created for SSR state preservation
 * @private
 */
const IDENTITY_REDUCER = Symbol('__rsk.identityReducer__');

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

  // Get known root reducer keys
  const rootReducerKeys = Object.keys(rootReducer);

  // Separate initial state into known (root) and dynamic (to be injected) state
  // This prevents "Unexpected key" warnings from combineReducers
  const filteredInitialState = {};
  const pendingDynamicState = {};

  Object.keys(initialState).forEach(key => {
    if (rootReducerKeys.includes(key)) {
      filteredInitialState[key] = initialState[key];
    } else {
      pendingDynamicState[key] = initialState[key];
    }
  });

  // Build middleware array
  const getMiddleware = getDefaultMiddleware => {
    const middleware = getDefaultMiddleware({
      thunk: {
        extraArgument: helpersConfig,
      },
      // Disable serializable check for i18n instance and other non-serializable data
      serializableCheck: false,
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
    // Enable duplicate middleware check
    duplicateMiddlewareCheck: true,
    preloadedState: filteredInitialState,
    middleware: getMiddleware,
    devTools: __DEV__
      ? {
          trace: true,
          traceLimit: 25,
        }
      : false,
  });

  /**
   * Injects a reducer into the store dynamically.
   * Used by modules to register their Redux slices at runtime.
   * Allows replacing identity reducers (created for SSR state) with real reducers.
   * @param {string} key - Reducer key in state
   * @param {Function} reducer - Reducer function
   * @param {Object} options - Injection options
   * @param {boolean} options.force - Force re-injection even if reducer exists
   */
  store.injectReducer = (key, reducer, options = {}) => {
    if (!key || typeof key !== 'string') {
      throw new Error('[Redux] injectReducer: key must be a non-empty string');
    }

    if (typeof reducer !== 'function') {
      throw new Error('[Redux] injectReducer: reducer must be a function');
    }

    const existingReducer = injectedReducers[key];
    const isIdentityReducer =
      existingReducer && existingReducer[IDENTITY_REDUCER] === true;

    // Skip injection if:
    // 1. Reducer already exists
    // 2. It's not an identity reducer
    // 3. Force option is not set
    if (existingReducer && !isIdentityReducer && !options.force) {
      if (__DEV__) {
        console.log(`[Redux] Reducer already injected: ${key}`);
      }
      return;
    }

    // Inject the reducer
    injectedReducers[key] = reducer;

    // Rebuild the root reducer with injected reducers
    const newRootReducer = combineReducers({
      ...rootReducer,
      ...injectedReducers,
    });

    store.replaceReducer(newRootReducer);

    if (__DEV__) {
      let action = 'Injected';
      if (isIdentityReducer) action = 'Replaced identity';
      else if (options.force) action = 'Force re-injected';
      console.log(`[Redux] ${action} reducer: ${key}`);
    }
  };

  /**
   * Creates an identity reducer that preserves SSR state.
   * Marked with IDENTITY_REDUCER symbol for later detection.
   * @private
   */
  const createIdentityReducer = ssrState => {
    const identityReducer = (state = ssrState) => state;
    // Mark as identity reducer for detection during injection
    identityReducer[IDENTITY_REDUCER] = true;
    return identityReducer;
  };

  // Pre-populate injected reducers with identity reducers for pending SSR state
  // This allows dynamic reducers to seamlessly take over the SSR state
  Object.keys(pendingDynamicState).forEach(key => {
    injectedReducers[key] = createIdentityReducer(pendingDynamicState[key]);
  });

  // If there's pending dynamic state, immediately replace the reducer to include it
  if (Object.keys(pendingDynamicState).length > 0) {
    store.replaceReducer(
      combineReducers({
        ...rootReducer,
        ...injectedReducers,
      }),
    );

    if (__DEV__) {
      console.log(
        `[Redux] Pre-loaded SSR state for: ${Object.keys(pendingDynamicState).join(', ')}`,
      );
    }
  }

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

  return store;
}
