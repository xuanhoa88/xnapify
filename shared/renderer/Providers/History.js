/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * History Provider
 *
 * Provides the browser history instance to the application via React Context.
 * This enables client-side navigation and history management throughout the app.
 *
 * @example
 * function App({ context }) {
 *   return (
 *     <HistoryProvider history={context.history}>
 *       <YourApp />
 *     </HistoryProvider>
 *   );
 * }
 */

import { createContext, useMemo } from 'react';

import PropTypes from 'prop-types';

/**
 * React Context for the history instance
 * @type {React.Context<Object|null>}
 */
export const HistoryContext = createContext(null);

/**
 * Provider component to make history available via context
 * @param {Object} props
 * @param {Object} props.history - History instance
 * @param {React.ReactNode} props.children
 */
export function HistoryProvider({ history, children }) {
  const value = useMemo(() => history, [history]);
  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}

HistoryProvider.propTypes = {
  history: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
};
