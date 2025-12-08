/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { configureStore as createStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';

/**
 * Configure and create Redux store using Redux Toolkit
 * @param {Object} initialState - Initial Redux state
 * @param {Object} helpersConfig - Extra argument for thunk middleware
 * @returns {Store} Configured Redux store
 */
export default function configureStore(initialState = {}, helpersConfig = {}) {
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
    reducer: rootReducer,
    preloadedState: initialState,
    middleware: getMiddleware,
    devTools: __DEV__
      ? {
          trace: true,
          traceLimit: 25,
        }
      : false,
  });

  // Enable Hot Module Replacement for reducers
  if (__DEV__ && module.hot) {
    module.hot.accept('./rootReducer', () => {
      try {
        const nextRootReducer = require('./rootReducer').default;
        store.replaceReducer(nextRootReducer);
      } catch (err) {
        console.error('Error during HMR of rootReducer:', err);
      }
    });
  }

  return store;
}
