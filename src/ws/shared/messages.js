/**
 * WebSocket Message Utilities
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
  } catch (error) {
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

/**
 * Validate message structure
 * @param {Object} message - Message to validate
 * @returns {boolean} True if valid
 */
export function isValidMessage(message) {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (!message.type || typeof message.type !== 'string') {
    return false;
  }

  return true;
}

/**
 * Create error message
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {string} Serialized error message
 */
export function createErrorMessage(code, message, details = null) {
  return createMessage('error', {
    code,
    message,
    details,
  });
}

/**
 * Create system message
 * @param {string} subtype - System message subtype (welcome, ping, pong)
 * @param {Object} data - Message data
 * @returns {string} Serialized system message
 */
export function createSystemMessage(subtype, data = {}) {
  return createMessage(`system:${subtype}`, data);
}

/**
 * Create authentication message
 * @param {string} subtype - Auth message subtype (login, success, failed)
 * @param {Object} data - Message data
 * @returns {string} Serialized auth message
 */
export function createAuthMessage(subtype, data = {}) {
  return createMessage(`auth:${subtype}`, data);
}

/**
 * Extract message type category
 * @param {string} type - Full message type (e.g., 'system:ping')
 * @returns {Object} Category and subtype
 */
export function parseMessageType(type) {
  const parts = type.split(':');
  return {
    category: parts[0] || 'custom',
    subtype: parts[1] || null,
  };
}
