/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Global WebSocket client instance
 * This allows components to access the client without needing React Context
 */
let wsClientInstance = null;

// Export shared constants
export * from './constants';

// Export shared messages
export * from './messages';

// Export shared logger
export * from './logger';

// Export shared errors
export * from './errors';

/**
 * Set the global WebSocket client instance
 * @param {WebSocketClient} client - WebSocket client instance
 */
export function setWebSocketClient(client) {
  wsClientInstance = client;
}

/**
 * Get the global WebSocket client instance
 * @returns {WebSocketClient|null} WebSocket client or null if not initialized
 */
export function useWebSocket() {
  return wsClientInstance;
}
