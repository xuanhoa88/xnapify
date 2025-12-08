/**
 * WebSocket Shared Constants
 */

/**
 * WebSocket message types
 */
export const MessageType = Object.freeze({
  // System messages
  SYSTEM_WELCOME: 'system:welcome',
  SYSTEM_PING: 'system:ping',
  SYSTEM_PONG: 'system:pong',

  // Authentication messages
  AUTH_LOGIN: 'auth:login',
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAILED: 'auth:failed',
  AUTH_LOGOUT: 'auth:logout',

  // Error messages
  ERROR: 'error',
});

/**
 * WebSocket error codes
 */
export const ErrorCode = Object.freeze({
  INVALID_MESSAGE: 'invalid_message',
  MESSAGE_ERROR: 'message_error',
  AUTH_DISABLED: 'auth_disabled',
  ALREADY_AUTHENTICATED: 'already_authenticated',
  MISSING_TOKEN: 'missing_token',
  AUTH_FAILED: 'auth_failed',
  NOT_AUTHENTICATED: 'not_authenticated',
  UNAUTHORIZED: 'unauthorized',
  INTERNAL_ERROR: 'internal_error',
});

/**
 * WebSocket connection states
 */
export const ConnectionState = Object.freeze({
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AUTHENTICATED: 'authenticated',
  DISCONNECTING: 'disconnecting',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
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
 * Event types
 */
export const EventType = Object.freeze({
  // Server events
  SERVER_STARTED: 'server:started',
  SERVER_STOPPED: 'server:stopped',
  CONNECTION_NEW: 'connection:new',
  CONNECTION_READY: 'connection:ready',
  CONNECTION_AUTHENTICATED: 'connection:authenticated',
  CONNECTION_CLOSED: 'connection:closed',
  CONNECTION_ERROR: 'connection:error',

  MESSAGE: 'message',

  // Client events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  AUTHENTICATED: 'authenticated',
  WELCOME: 'welcome',
  RECONNECTING: 'reconnecting',
  RECONNECT_FAILED: 'reconnect_failed',
  CONNECTION_ERROR_CLIENT: 'connection_error',
});
