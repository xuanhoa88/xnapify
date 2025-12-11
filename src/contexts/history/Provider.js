/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createContext, useMemo } from 'react';
import PropTypes from 'prop-types';

// =============================================================================
// CONTEXT
// =============================================================================

const HistoryContext = createContext(null);

// =============================================================================
// PROVIDER
// =============================================================================

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

export default HistoryContext;
