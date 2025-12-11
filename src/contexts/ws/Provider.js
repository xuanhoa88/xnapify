/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createContext } from 'react';
import PropTypes from 'prop-types';

/**
 * WebSocket Context
 */
const WebSocketContext = createContext(null);

/**
 * WebSocket Provider Component
 * Wraps the app to provide WebSocket client access to all components
 */
export function WebSocketProvider({ client, children }) {
  return (
    <WebSocketContext.Provider value={client}>
      {children}
    </WebSocketContext.Provider>
  );
}

WebSocketProvider.propTypes = {
  client: PropTypes.object,
  children: PropTypes.node.isRequired,
};

export default WebSocketContext;
