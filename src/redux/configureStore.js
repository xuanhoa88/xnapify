/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import rootReducer from './rootReducer';

/**
 * Configure and create Redux store
 * @param {Object} initialState - Initial Redux state
 * @param {Object} helpersConfig - Extra argument for thunk middleware
 * @returns {Store} Configured Redux store
 */
export default function configureStore(initialState = {}, helpersConfig = {}) {
  // Initialize middleware array with thunk first
  const middleware = [thunk.withExtraArgument(helpersConfig)];

  // Add development-only middleware
  if (__DEV__) {
    // Add Redux Logger (should be last middleware)
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

  // Configure store enhancers
  let enhancer;

  if (__DEV__) {
    // Try to use Redux DevTools Extension
    try {
      const { composeWithDevTools } = require('@redux-devtools/extension');
      enhancer = composeWithDevTools({
        trace: true,
        traceLimit: 25,
      })(applyMiddleware(...middleware));
    } catch (err) {
      console.warn('Redux DevTools Extension not available:', err.message);
      enhancer = applyMiddleware(...middleware);
    }
  } else {
    // Production: just apply middleware
    enhancer = applyMiddleware(...middleware);
  }

  // Create store
  const store = createStore(rootReducer, initialState, enhancer);

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
