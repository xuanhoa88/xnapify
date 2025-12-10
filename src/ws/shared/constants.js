/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * WebSocket message types
 */
export const MessageType = Object.freeze({
  // System messages
  WELCOME: 'welcome',
  PING: 'ping',
  PONG: 'pong',

  // Authentication messages
  AUTH_LOGIN: 'auth:login',
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAILED: 'auth:failed',
  AUTH_LOGOUT: 'auth:logout',

  // Channel messages
  CHANNEL_SUBSCRIBE: 'channel:subscribe',
  CHANNEL_UNSUBSCRIBE: 'channel:unsubscribe',
  CHANNEL_SUBSCRIBED: 'channel:subscribed',
  CHANNEL_UNSUBSCRIBED: 'channel:unsubscribed',
  CHANNEL_MESSAGE: 'channel:message',
  CHANNEL_ERROR: 'channel:error',

  // Error messages
  ERROR: 'error',
});

/**
 * Channel types
 */
export const ChannelType = Object.freeze({
  PUBLIC: 'public', // Anyone can subscribe
  PROTECTED: 'protected', // Only authenticated users
});

/**
 * WebSocket error codes
 */
export const ErrorCode = Object.freeze({
  // Message errors
  INVALID_MESSAGE: 'invalid_message',
  MESSAGE_ERROR: 'message_error',

  // Authentication errors
  AUTHENTICATION_REQUIRED: 'authentication_required',
  AUTHENTICATION_FAILED: 'authentication_failed',
  ALREADY_AUTHENTICATED: 'already_authenticated',
  AUTHENTICATION_NOT_CONFIGURED: 'authentication_not_configured',
  INVALID_AUTHENTICATION_RESULT: 'invalid_authentication_result',

  // Channel errors
  CHANNEL_NAME_REQUIRED: 'channel_name_required',
  CHANNEL_NOT_FOUND: 'channel_not_found',

  // Access errors
  ACCESS_DENIED: 'access_denied',

  // System errors
  INTERNAL_ERROR: 'internal_error',
});

/**
 * WebSocket close codes
 */
export const CloseCode = Object.freeze({
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  INTERNAL_ERROR: 1011,
});

/**
 * Default configuration values
 */
export const DefaultConfig = Object.freeze({
  // Server defaults
  SERVER_PORT: 8080,
  SERVER_PATH: '/ws',
  MAX_PAYLOAD_SIZE: 16 * 1024, // 16KB
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  AUTH_TIMEOUT: 10000, // 10 seconds

  // Client defaults
  CLIENT_URL: 'ws://localhost:8080/ws',
  AUTO_RECONNECT: true,
  RECONNECT_INTERVAL: 5000, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 10,
  MESSAGE_QUEUE_SIZE: 100,

  // Logging defaults
  ENABLE_LOGGING: true,
  LOG_LEVEL: 'info',
});

/**
 * Log levels
 */
export const LogLevel = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
});

/**
 * Event types (shared between server and client)
 * Environment-specific events are defined in server/index.js and client/index.js
 */
export const EventType = Object.freeze({
  AUTHENTICATED: 'authenticated',
  MESSAGE: 'message',
});
