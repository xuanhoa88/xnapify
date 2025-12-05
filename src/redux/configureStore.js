/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import rootReducer from './rootReducer';

let composeEnhancers = applyMiddleware; // fallback for production

if (__DEV__) {
  try {
    // Loaded only in dev environment (browser)
    const { composeWithDevTools } = require('@redux-devtools/extension');
    composeEnhancers = composeWithDevTools;
  } catch {
    // ignore — often happens during SSR or no extension installed
    composeEnhancers = applyMiddleware;
  }
}

/**
 * Configure and create Redux store
 */
export default function configureStore(initialState = {}, helpersConfig = {}) {
  const middleware = [thunk.withExtraArgument(helpersConfig)];

  // Add Redux Logger only in development
  if (__DEV__) {
    const { createLogger } = require('redux-logger');
    middleware.push(
      createLogger({
        collapsed: true,
        duration: true,
        timestamp: false,
      }),
    );
  }

  // Create final enhancer
  const enhancer = composeEnhancers(applyMiddleware(...middleware));

  const store = createStore(rootReducer, initialState, enhancer);

  // Enable HMR only in real client-dev (NOT SSR)
  if (__DEV__ && typeof module !== 'undefined' && module.hot) {
    module.hot.accept('./rootReducer', () => {
      const nextRootReducer = require('./rootReducer').default;
      store.replaceReducer(nextRootReducer);
    });
  }

  return store;
}
