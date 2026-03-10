/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import {
  DefaultConfig,
  MessageType,
  EventType as SharedEventType,
  parseMessage,
  createLogger,
} from '../utils';

/**
 * Global WebSocket client instance
 * This allows components to access the client without needing React Context
 */
let wsClientInstance = null;

/**
 * Client-specific event types
 */
const ClientEventType = Object.freeze({
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  RECONNECT_FAILED: 'reconnect:failed',
  CHANNEL_SUBSCRIBED: 'channel:subscribed',
  CHANNEL_UNSUBSCRIBED: 'channel:unsubscribed',
  CHANNEL_MESSAGE: 'channel:message',
  CHANNEL_ERROR: 'channel:error',
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
class WebSocketClient extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration - handle false values explicitly
    this.config = {
      url: options.url || DefaultConfig.CLIENT_URL,
      autoReconnect:
        options.autoReconnect != null
          ? options.autoReconnect
          : DefaultConfig.AUTO_RECONNECT,
      reconnectInterval:
        options.reconnectInterval || DefaultConfig.RECONNECT_INTERVAL,
      maxReconnectAttempts:
        options.maxReconnectAttempts || DefaultConfig.MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval:
        options.heartbeatInterval || DefaultConfig.HEARTBEAT_INTERVAL,
      enableLogging:
        options.enableLogging != null
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

    // Channel subscriptions
    this.subscribedChannels = new Set();

    this.logger.info('🚀 Client initialized', { url: this.config.url });
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  /**
   * Connect to server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.logger.warn('⚠️ Already connected');
      return;
    }

    this.logger.info(`🔌 Connecting to ${this.config.url}`);

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
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

        this.logger.info('🔌 Disconnected', {
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
        this.logger.error('❌ Connection error', { error: event });
        // Only emit if there are listeners to prevent unhandled error
        if (this.listenerCount(EventType.ERROR) > 0) {
          this.emit(EventType.ERROR, event);
        }
      };

      this.ws.onmessage = event => {
        // eslint-disable-next-line no-underscore-dangle
        this._handleMessage(event);
      };
    } catch (err) {
      this.logger.error('❌ Connection failed', { error: err.message });
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
    this.subscribedChannels.clear();
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
      this.logger.error('❌ Max reconnect attempts reached');
      this.emit(EventType.RECONNECT_FAILED);
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5);

    this.logger.info(
      `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
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
    const message = parseMessage(event.data);
    if (!message) {
      this.logger.warn('⚠️ Invalid message received');
      return;
    }

    this.logger.debug(`Received: ${message.type}`, { data: message.data });

    // eslint-disable-next-line no-underscore-dangle
    const handler = this._getMessageHandler(message.type);
    if (typeof handler === 'function') {
      try {
        handler.call(this, message.data);
      } catch (err) {
        this.logger.error('❌ Message handling error', { error: err.message });
      }
    } else {
      // Custom message - emit both generic and specific
      this.emit(EventType.MESSAGE, message);
      this.emit(message.type, message.data);
    }
  }

  /**
   * Get handler for message type
   */
  _getMessageHandler(type) {
    const handlers = {
      // eslint-disable-next-line no-underscore-dangle
      [MessageType.WELCOME]: this._handleWelcome.bind(this),
      [MessageType.PONG]: () => {}, // No-op
      // eslint-disable-next-line no-underscore-dangle
      [MessageType.AUTH_SUCCESS]: this._handleAuthSuccess.bind(this),
      // eslint-disable-next-line no-underscore-dangle
      [MessageType.AUTH_FAILED]: this._handleAuthFailed.bind(this),
      [MessageType.CHANNEL_SUBSCRIBED]:
        // eslint-disable-next-line no-underscore-dangle
        this._handleChannelSubscribed.bind(this),
      [MessageType.CHANNEL_UNSUBSCRIBED]:
        // eslint-disable-next-line no-underscore-dangle
        this._handleChannelUnsubscribed.bind(this),
      // eslint-disable-next-line no-underscore-dangle
      [MessageType.CHANNEL_MESSAGE]: this._handleChannelMessage.bind(this),
      // eslint-disable-next-line no-underscore-dangle
      [MessageType.CHANNEL_ERROR]: this._handleChannelError.bind(this),
      // eslint-disable-next-line no-underscore-dangle
      [MessageType.ERROR]: this._handleError.bind(this),
    };
    return handlers[type];
  }

  /**
   * Handle Welcome message
   */
  _handleWelcome(data) {
    this.connectionId = data && data.connectionId;
    this.reconnectAttempts = 0;
    this.emit(MessageType.WELCOME, data);
  }

  /**
   * Handle Auth Success
   */
  _handleAuthSuccess(data) {
    this.user = (data && data.user) || null;
    if (this.user) {
      this.isAuthenticated = true;
      this.logger.info(`🔐 Authenticated as: ${this.user && this.user.id}`);
      this.emit(EventType.AUTHENTICATED, this.user);
    } else {
      // eslint-disable-next-line no-underscore-dangle
      this._handleAuthFailed({ code: 401, message: 'Invalid authentication' });
    }
  }

  /**
   * Handle Auth Failed
   */
  _handleAuthFailed(data) {
    this.isAuthenticated = false;
    this.user = null;
    this.logger.warn(`🔒 Authentication failed: ${data && data.message}`);
    this.emit(EventType.UNAUTHENTICATED, data);
  }

  /**
   * Handle Channel Subscribed
   */
  _handleChannelSubscribed(data) {
    const channel = (data && data.channel) || null;
    if (!channel) return;

    this.subscribedChannels.add(channel);
    this.logger.info(`📢 Subscribed to: ${channel}`);
    this.emit(EventType.CHANNEL_SUBSCRIBED, data);
  }

  /**
   * Handle Channel Unsubscribed
   */
  _handleChannelUnsubscribed(data) {
    const channel = (data && data.channel) || null;
    if (!channel) return;

    this.subscribedChannels.delete(channel);
    this.logger.info(`📢 Unsubscribed from: ${channel}`);
    this.emit(EventType.CHANNEL_UNSUBSCRIBED, data);
  }

  /**
   * Handle Channel Message
   */
  _handleChannelMessage(data) {
    if (!data) return;

    const { channel, type, data: payload } = data;
    this.logger.debug(`📢 Channel message from ${channel}: ${type}`);

    // Emit generic channel message event
    this.emit(EventType.CHANNEL_MESSAGE, { channel, type, data: payload });
    // Emit channel-specific event
    this.emit(`channel:${channel}`, { type, data: payload });
    // Emit message type event
    if (type) this.emit(type, payload);
  }

  /**
   * Handle Channel Error
   */
  _handleChannelError(data) {
    this.logger.warn('⚠️ Channel error', { error: data });
    this.emit(EventType.CHANNEL_ERROR, data);
  }

  /**
   * Handle Server Error
   */
  _handleError(data) {
    this.logger.warn(`⚠️ Server error: ${data && data.code}`, { error: data });
    this.emit('error', data);
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
        this.logger.warn('⚠️ Queue full, dropping message');
      }
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.logger.debug(`Sent: ${type}`);
      return true;
    } catch (err) {
      this.logger.error('❌ Send failed', { type, error: err.message });
      return false;
    }
  }

  /**
   * Flush queued messages
   */
  _flushQueue() {
    if (this.messageQueue.length === 0) return;

    const count = this.messageQueue.length;
    this.logger.info(`📤 Flushing ${count} queued messages`);

    while (this.messageQueue.length > 0 && this.isConnected()) {
      const msg = this.messageQueue.shift();
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        this.logger.error('❌ Flush failed', {
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
   * Login with token
   */
  login(token) {
    if (!this.isConnected()) {
      this.logger.warn('⚠️ Cannot authenticate: not connected');
      return false;
    }

    if (this.isAuthenticated) {
      this.logger.warn('⚠️ Already authenticated');
      return true;
    }

    return this.send(MessageType.AUTH_LOGIN, { token });
  }

  /**
   * Logout from server
   */
  logout() {
    if (!this.isConnected()) {
      this.logger.warn('⚠️ Cannot logout: not connected');
      return false;
    }

    if (!this.isAuthenticated) {
      this.logger.warn('⚠️ Not authenticated');
      return false;
    }

    const result = this.send(MessageType.AUTH_LOGOUT);

    // Update local state immediately
    // eslint-disable-next-line no-underscore-dangle
    this._handleAuthFailed({
      code: 200,
      message: 'Logout successfully',
    });

    return result;
  }

  // ============================================================================
  // CHANNELS
  // ============================================================================

  /**
   * Subscribe to a channel
   */
  subscribe(channelName) {
    if (!this.isConnected()) {
      this.logger.warn('⚠️ Cannot subscribe: not connected');
      return false;
    }

    if (this.subscribedChannels.has(channelName)) {
      this.logger.warn(`⚠️ Already subscribed to: ${channelName}`);
      return true;
    }

    return this.send(MessageType.CHANNEL_SUBSCRIBE, { channel: channelName });
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelName) {
    if (!this.isConnected()) {
      this.logger.warn('⚠️ Cannot unsubscribe: not connected');
      return false;
    }

    if (!this.subscribedChannels.has(channelName)) {
      this.logger.warn(`⚠️ Not subscribed to: ${channelName}`);
      return false;
    }

    return this.send(MessageType.CHANNEL_UNSUBSCRIBE, { channel: channelName });
  }

  /**
   * Get list of subscribed channels
   */
  getSubscribedChannels() {
    return [...this.subscribedChannels];
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
      subscribedChannels: this.getSubscribedChannels(),
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
    this.subscribedChannels.clear();
    this.removeAllListeners();
    this.logger.info('🛑 Client disposed');
  }
}

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

/**
 * Factory function
 */
export function createWebSocketClient(options = {}) {
  const wsClientInstance = new WebSocketClient(options);
  setWebSocketClient(wsClientInstance);
  return wsClientInstance;
}

// Re-export types for convenience
export { EventType, MessageType };
