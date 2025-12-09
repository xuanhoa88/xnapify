/**
 * WebSocket Client - Simplified Implementation
 * Consolidates ConnectionManager, ReconnectionHandler, MessageQueue, HeartbeatManager
 */

import { EventEmitter } from 'events';

import {
  DefaultConfig,
  MessageType,
  EventType as SharedEventType,
} from '../shared/constants';
import { parseMessage } from '../shared/messages';
import { createLogger } from '../shared/logger';

/**
 * Client-specific event types
 */
const ClientEventType = Object.freeze({
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  RECONNECT_FAILED: 'reconnect:failed',
  ERROR: 'error',
});

/**
 * Combined EventType (shared + client-specific)
 */
const EventType = Object.freeze({
  ...SharedEventType,
  ...ClientEventType,
});

/**
 * WebSocket Client Class
 */
export class WebSocketClient extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration - handle false values explicitly
    this.config = {
      url: options.url || DefaultConfig.CLIENT_URL,
      autoReconnect:
        options.autoReconnect !== undefined
          ? options.autoReconnect
          : DefaultConfig.AUTO_RECONNECT,
      reconnectInterval:
        options.reconnectInterval || DefaultConfig.RECONNECT_INTERVAL,
      maxReconnectAttempts:
        options.maxReconnectAttempts || DefaultConfig.MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval:
        options.heartbeatInterval || DefaultConfig.HEARTBEAT_INTERVAL,
      enableLogging:
        options.enableLogging !== undefined
          ? options.enableLogging
          : DefaultConfig.ENABLE_LOGGING,
      logLevel: options.logLevel || DefaultConfig.LOG_LEVEL,
      maxQueueSize: options.maxQueueSize || DefaultConfig.MESSAGE_QUEUE_SIZE,
    };

    // Logger
    this.logger = createLogger('WebSocket Client', {
      enableLogging: this.config.enableLogging,
      logLevel: this.config.logLevel,
    });

    // State
    this.ws = null;
    this.connectionId = null;
    this.isAuthenticated = false;
    this.user = null;

    // Reconnection
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.reconnectEnabled = this.config.autoReconnect;

    // Heartbeat
    this.heartbeatTimer = null;

    // Message queue (for offline messages)
    this.messageQueue = [];

    this.logger.info('Client initialized', { url: this.config.url });
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  /**
   * Connect to server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.logger.warn('Already connected');
      return;
    }

    this.logger.info(`Connecting to ${this.config.url}`);

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.logger.info('✅ Connected');
        this.reconnectAttempts = 0;
        // eslint-disable-next-line no-underscore-dangle
        this._startHeartbeat();
        // eslint-disable-next-line no-underscore-dangle
        this._flushQueue();
        this.emit(EventType.CONNECTED);
      };

      this.ws.onclose = event => {
        // eslint-disable-next-line no-underscore-dangle
        this._stopHeartbeat();
        this.isAuthenticated = false;
        this.user = null;

        this.logger.info(`🔌 Disconnected`, {
          code: event.code,
          reason: event.reason,
        });
        this.emit(EventType.DISCONNECTED, {
          code: event.code,
          reason: event.reason,
        });

        // Auto-reconnect
        if (this.reconnectEnabled && event.code !== 1000) {
          // eslint-disable-next-line no-underscore-dangle
          this._scheduleReconnect();
        }
      };

      this.ws.onerror = event => {
        this.logger.error('❌ Error', { error: event });
        this.emit(EventType.ERROR, event);
      };

      this.ws.onmessage = event => {
        // eslint-disable-next-line no-underscore-dangle
        this._handleMessage(event);
      };
    } catch (err) {
      this.logger.error('Connection failed', { error: err.message });
      // eslint-disable-next-line no-underscore-dangle
      this._scheduleReconnect();
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.reconnectEnabled = false;
    // eslint-disable-next-line no-underscore-dangle
    this._cancelReconnect();
    // eslint-disable-next-line no-underscore-dangle
    this._stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connectionId = null;
    this.isAuthenticated = false;
    this.user = null;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // RECONNECTION
  // ============================================================================

  /**
   * Schedule reconnect attempt
   */
  _scheduleReconnect() {
    if (!this.reconnectEnabled) return;

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached');
      this.emit(EventType.RECONNECT_FAILED);
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5);

    this.logger.info(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.emit(EventType.RECONNECTING, this.reconnectAttempts);
      this.connect();
    }, delay);
  }

  /**
   * Cancel pending reconnect
   */
  _cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ============================================================================
  // HEARTBEAT
  // ============================================================================

  /**
   * Start heartbeat
   */
  _startHeartbeat() {
    // eslint-disable-next-line no-underscore-dangle
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send(MessageType.PING);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Handle incoming message
   */
  _handleMessage(event) {
    try {
      const message = parseMessage(event.data);
      if (!message) {
        this.logger.warn('Invalid message received');
        return;
      }

      this.logger.debug(`Received: ${message.type}`, { data: message.data });

      switch (message.type) {
        case MessageType.WELCOME:
          this.connectionId = message.data && message.data.connectionId;
          this.reconnectAttempts = 0;
          this.emit(MessageType.WELCOME, message.data);
          break;

        case MessageType.PONG:
          // Heartbeat response - no action needed
          break;

        case MessageType.AUTH_SUCCESS:
          this.isAuthenticated = true;
          this.user = (message.data && message.data.user) || null;
          this.logger.info(
            '🔐 Authenticated as: ' + (this.user && this.user.id),
          );
          this.emit(EventType.AUTHENTICATED, this.user);
          break;

        case MessageType.ERROR:
          this.logger.warn(
            'Server error: ' + (message.data && message.data.code),
            {
              error: message.data,
            },
          );
          this.emit('error', message.data);
          break;

        default:
          // Custom message - emit both generic and specific
          this.emit(EventType.MESSAGE, message);
          this.emit(message.type, message.data);
      }
    } catch (err) {
      this.logger.error('Message handling error', { error: err.message });
    }
  }

  // ============================================================================
  // SENDING
  // ============================================================================

  /**
   * Send message
   */
  send(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    if (!this.isConnected()) {
      // Queue for later
      if (this.messageQueue.length < this.config.maxQueueSize) {
        this.messageQueue.push(message);
        this.logger.debug(`Queued: ${type}`);
      } else {
        this.logger.warn('Queue full, dropping message');
      }
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.logger.debug(`Sent: ${type}`);
      return true;
    } catch (err) {
      this.logger.error('Send failed', { type, error: err.message });
      return false;
    }
  }

  /**
   * Flush queued messages
   */
  _flushQueue() {
    if (this.messageQueue.length === 0) return;

    const count = this.messageQueue.length;
    this.logger.info(`Flushing ${count} queued messages`);

    while (this.messageQueue.length > 0 && this.isConnected()) {
      const msg = this.messageQueue.shift();
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        this.logger.error('Flush failed', {
          type: msg.type,
          error: err.message,
        });
      }
    }
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Authenticate with token
   */
  authenticate(token) {
    if (!this.isConnected()) {
      this.logger.warn('Cannot authenticate: not connected');
      return false;
    }

    if (this.isAuthenticated) {
      this.logger.warn('Already authenticated');
      return true;
    }

    return this.send(MessageType.AUTH_LOGIN, { token });
  }

  // ============================================================================
  // STATUS
  // ============================================================================

  /**
   * Get client status
   */
  getStatus() {
    return {
      isConnected: this.isConnected(),
      isAuthenticated: this.isAuthenticated,
      connectionId: this.connectionId,
      user: this.user,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose client
   */
  dispose() {
    this.disconnect();
    this.messageQueue = [];
    this.removeAllListeners();
    this.logger.info('Client disposed');
  }
}

/**
 * Factory function
 */
export function createWebSocketClient(options = {}) {
  return new WebSocketClient(options);
}

// Re-export types for convenience
export { EventType };
export { MessageType } from '../shared/constants';
