/**
 * WebSocket Client
 * Refactored to use modular components
 */

import { EventEmitter } from 'events';

import { DefaultConfig, MessageType, EventType } from '../shared/constants';
import { parseMessage } from '../shared/messages';
import { createLogger } from '../shared/logger';

import { ConnectionManager } from './ConnectionManager';
import { ReconnectionHandler } from './ReconnectionHandler';
import { MessageQueue } from './MessageQueue';
import { HeartbeatManager } from './HeartbeatManager';

/**
 * WebSocket Client Class
 */
export class WebSocketClient extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      url: options.url || DefaultConfig.CLIENT_URL,
      autoReconnect: options.autoReconnect || DefaultConfig.AUTO_RECONNECT,
      reconnectInterval:
        options.reconnectInterval || DefaultConfig.RECONNECT_INTERVAL,
      maxReconnectAttempts:
        options.maxReconnectAttempts || DefaultConfig.MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval:
        options.heartbeatInterval || DefaultConfig.HEARTBEAT_INTERVAL,
      enableLogging: options.enableLogging || DefaultConfig.ENABLE_LOGGING,
      logLevel: options.logLevel || DefaultConfig.LOG_LEVEL,
      maxQueueSize: options.maxQueueSize || DefaultConfig.MESSAGE_QUEUE_SIZE,
    };

    // Create logger
    this.logger = createLogger('WebSocket Client', {
      enableLogging: this.config.enableLogging,
      logLevel: this.config.logLevel,
    });

    // Create managers
    this.connectionManager = new ConnectionManager({
      url: this.config.url,
    });

    this.reconnectionHandler = new ReconnectionHandler({
      autoReconnect: this.config.autoReconnect,
      reconnectInterval: this.config.reconnectInterval,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
    });

    this.messageQueue = new MessageQueue({
      maxQueueSize: this.config.maxQueueSize,
    });

    this.heartbeatManager = new HeartbeatManager({
      heartbeatInterval: this.config.heartbeatInterval,
    });

    // Client state
    this.isAuthenticated = false;
    this.user = null;

    // Bind methods first
    this.handleMessage = this.handleMessage.bind(this);

    // Setup event forwarding (uses bound handleMessage)
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from managers
   */
  setupEventForwarding() {
    // Connection manager events
    this.connectionManager.on(EventType.CONNECTED, () => {
      this.logger.info('✅ WebSocket connected');
      this.emit(EventType.CONNECTED);

      // Start heartbeat
      this.heartbeatManager.start(() => this.sendHeartbeat());

      // Flush queued messages
      this.flushMessageQueue();
    });

    this.connectionManager.on(EventType.DISCONNECTED, info => {
      this.isAuthenticated = false;
      this.user = null;

      this.heartbeatManager.stop();

      this.logger.info('🔌 WebSocket disconnected', info);
      this.emit(EventType.DISCONNECTED, info);

      // Schedule reconnect if needed
      if (this.reconnectionHandler.isEnabled()) {
        this.reconnectionHandler.scheduleReconnect(() => this.connect());
      }
    });

    this.connectionManager.on(EventType.CONNECTION_ERROR_CLIENT, event => {
      this.logger.error('❌ WebSocket error', { error: event });
      this.emit(EventType.CONNECTION_ERROR_CLIENT, event);
    });

    // Reconnection handler events
    this.reconnectionHandler.on('reconnect_scheduled', info => {
      this.logger.info(
        `Scheduling reconnect attempt ${info.attempt} in ${info.delay}ms`,
      );
    });

    this.reconnectionHandler.on(EventType.RECONNECTING, attempt => {
      this.logger.info(`Reconnect attempt ${attempt}`);
      this.emit(EventType.RECONNECTING, attempt);
    });

    this.reconnectionHandler.on(EventType.RECONNECT_FAILED, () => {
      this.logger.error('Max reconnection attempts reached');
      this.emit(EventType.RECONNECT_FAILED);
    });

    // Message queue events
    this.messageQueue.on('message:queued', message => {
      this.logger.debug(`Message queued: ${message.type}`, { message });
    });

    this.messageQueue.on('queue:flushed', count => {
      this.logger.info(`Sent ${count} queued messages`);
    });

    this.messageQueue.on('queue:full', message => {
      this.logger.warn('Message queue is full, dropping message', { message });
    });

    // Heartbeat manager events
    this.heartbeatManager.on('heartbeat:pong', () => {
      this.logger.debug('Heartbeat pong received');
    });

    // Add message listener to connection manager
    this.connectionManager.addMessageListener(this.handleMessage);
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    this.logger.info(`Connecting to WebSocket server: ${this.config.url}`);
    this.connectionManager.connect();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.reconnectionHandler.disable();
    this.reconnectionHandler.cancelReconnect();
    this.heartbeatManager.stop();
    this.connectionManager.disconnect();
  }

  /**
   * Authenticate with JWT token
   * @param {string} token - JWT token
   * @returns {boolean} True if authentication request sent
   */
  authenticate(token) {
    if (!this.connectionManager.isConnected()) {
      this.logger.warn('Cannot authenticate: not connected');
      return false;
    }

    if (this.isAuthenticated) {
      this.logger.warn('Already authenticated');
      return true;
    }

    this.send(MessageType.AUTH_LOGIN, { token });
    return true;
  }

  /**
   * Send custom message
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {boolean} True if sent successfully
   */
  send(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    if (!this.connectionManager.isConnected()) {
      // Queue message for later
      this.messageQueue.enqueue(message);
      return false;
    }

    try {
      const serialized = JSON.stringify(message);
      this.connectionManager.send(serialized);
      this.logger.debug(`Message sent: ${type}`, { message });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message: ${type}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Handle WebSocket message
   * @param {MessageEvent} event - Message event
   */
  handleMessage(event) {
    try {
      const message = parseMessage(event.data);
      if (!message) {
        this.logger.warn('Received invalid message');
        return;
      }

      const data = message.data || {};
      this.logger.debug(`Message received: ${message.type}`, { message });

      // Handle system messages
      switch (message.type) {
        case MessageType.SYSTEM_WELCOME:
          if (data.connectionId) {
            this.connectionManager.setConnectionId(data.connectionId);
          }
          this.reconnectionHandler.reset();
          this.emit(EventType.WELCOME, data);
          break;

        case MessageType.SYSTEM_PONG:
          this.heartbeatManager.recordPong();
          break;

        case MessageType.AUTH_SUCCESS:
          this.isAuthenticated = true;
          this.user = data.user || null;
          if (this.user) {
            this.logger.info(`🔐 Authenticated as: ${this.user.id}`);
          }
          this.emit(EventType.AUTHENTICATED, this.user);
          break;

        case MessageType.ERROR:
          this.logger.warn(`Server error: ${data.code || 'unknown'}`, {
            error: data,
          });
          this.emit('error', data);
          break;

        default:
          // Emit custom message
          this.emit(EventType.MESSAGE, message);
          this.emit(message.type, data);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to parse message', {
          error: (error && error.message) || 'Unknown error',
          data: event.data,
        });
      } else {
        console.error('[WebSocket Client] Failed to parse message:', error);
      }
    }
  }

  /**
   * Send heartbeat ping
   */
  sendHeartbeat() {
    if (this.connectionManager.isConnected()) {
      this.send(MessageType.SYSTEM_PING);
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    this.messageQueue.flush(message => {
      try {
        const serialized = JSON.stringify(message);
        this.connectionManager.send(serialized);
      } catch (error) {
        this.logger.error(`Failed to send queued message: ${message.type}`, {
          error: error.message,
        });
      }
    });
  }

  /**
   * Get client status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isConnected: this.connectionManager.isConnected(),
      isAuthenticated: this.isAuthenticated,
      connectionId: this.connectionManager.getConnectionId(),
      user: this.user,
      reconnectAttempts: this.reconnectionHandler.getAttempts(),
      queuedMessages: this.messageQueue.size(),
      state: this.connectionManager.getState(),
    };
  }

  /**
   * Dispose the client and cleanup all resources
   */
  dispose() {
    // Disconnect first
    this.disconnect();

    // Remove all event listeners from managers
    this.connectionManager.removeAllListeners();
    this.reconnectionHandler.removeAllListeners();
    this.messageQueue.removeAllListeners();
    this.heartbeatManager.removeAllListeners();

    // Clear message handler reference
    this.connectionManager.removeMessageListener(this.handleMessage);

    // Remove own listeners
    this.removeAllListeners();

    this.logger.info('WebSocket client disposed');
  }
}

/**
 * Create WebSocket client
 * @param {Object} options - Client configuration
 * @returns {WebSocketClient} WebSocket client instance
 */
export function createWebSocketClient(options = {}) {
  return new WebSocketClient(options);
}
