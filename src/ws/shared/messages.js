/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Parse WebSocket message from raw data
 * @param {string|Buffer} data - Raw message data
 * @returns {Object|null} Parsed message or null if invalid
 */
export function parseMessage(data) {
  try {
    const message = JSON.parse(data.toString());
    if (!message.type) {
      return null;
    }
    return message;
  } catch {
    return null;
  }
}

/**
 * Create WebSocket message
 * @param {string} type - Message type
 * @param {Object} data - Message data
 * @returns {string} Serialized message
 */
export function createMessage(type, data = {}) {
  return JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
  });
}
