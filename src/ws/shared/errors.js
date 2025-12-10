/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Base WebSocket error
 */
export class WebSocketError extends Error {
  constructor(message, code = 'WEBSOCKET_ERROR', details = null) {
    super(message);
    this.name = 'WebSocketError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends WebSocketError {
  constructor(message, details = null) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Connection error
 */
export class ConnectionError extends WebSocketError {
  constructor(message, details = null) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

/**
 * Message error
 */
export class MessageError extends WebSocketError {
  constructor(message, details = null) {
    super(message, 'MESSAGE_ERROR', details);
    this.name = 'MessageError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends WebSocketError {
  constructor(message, details = null) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Server error
 */
export class ServerError extends WebSocketError {
  constructor(message, details = null) {
    super(message, 'SERVER_ERROR', details);
    this.name = 'ServerError';
  }
}
