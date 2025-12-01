/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { composeWithDevTools } from '@redux-devtools/extension';
import { applyMiddleware, createStore } from 'redux';
import { createLogger } from 'redux-logger';
import thunk from 'redux-thunk';
import rootReducer from './rootReducer';

/**
 * Configure and create Redux store
 *
 * @param {Object} [initialState={}] - Initial Redux state
 * @param {Object} [helpersConfig={}] - Configuration for thunk helpers
 * @param {Function} [helpersConfig.fetch] - Fetch client for API calls
 * @param {Object} [helpersConfig.i18n] - i18next instance for internationalization
 * @returns {Object} Configured Redux store
 */
export default function configureStore(initialState = {}, helpersConfig = {}) {
  // Setup middleware
  const middleware = [thunk.withExtraArgument(helpersConfig)];

  // Add Redux Logger in development
  if (__DEV__) {
    middleware.push(
      createLogger({
        collapsed: true,
        duration: true,
        timestamp: false,
      }),
    );
  }

  // Create store enhancer
  const enhancer = __DEV__
    ? composeWithDevTools(applyMiddleware(...middleware))
    : applyMiddleware(...middleware);

  // Create store
  const store = createStore(rootReducer, initialState, enhancer);

  // Enable hot module replacement for reducers (development only)
  if (module.hot) {
    module.hot.accept('./rootReducer', () => {
      // eslint-disable-next-line global-require
      const nextRootReducer = require('./rootReducer').default;
      store.replaceReducer(nextRootReducer);
    });
  }

  return store;
}
