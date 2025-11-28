/**
 * WebSocket Client
 *
 * Simple WebSocket client for connecting to the React Starter Kit WebSocket server.
 * Provides a clean API for client-side WebSocket communication with automatic
 * reconnection, authentication.
 */

import { EventEmitter } from 'events';

/**
 * WebSocket Client Class
 */
export class WebSocketClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      url: 'ws://localhost:8080/ws',
      autoReconnect: true,
      reconnectInterval: 5000, // 5 seconds
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000, // 30 seconds
      enableLogging: true,
      logLevel: 'info',
      ...options,
    };

    // Client state
    this.ws = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.connectionId = null;
    this.user = null;

    // Reconnection state
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.shouldReconnect = true;

    // Heartbeat
    this.heartbeatTimer = null;
    this.lastPong = null;

    // Message queue for offline messages
    this.messageQueue = [];

    // Bind methods
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      this.log('info', `Connecting to WebSocket server: ${this.config.url}`);

      this.ws = new WebSocket(this.config.url);
      this.ws.addEventListener('open', this.handleOpen);
      this.ws.addEventListener('message', this.handleMessage);
      this.ws.addEventListener('close', this.handleClose);
      this.ws.addEventListener('error', this.handleError);
    } catch (error) {
      this.log('error', 'Failed to create WebSocket connection', {
        error: error.message,
      });
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
  }

  /**
   * Authenticate with JWT token
   */
  authenticate(token) {
    if (!this.isConnected) {
      this.log('warn', 'Cannot authenticate: not connected');
      return false;
    }

    if (this.isAuthenticated) {
      this.log('warn', 'Already authenticated');
      return true;
    }

    this.send('auth:login', { token });
    return true;
  }

  /**
   * Send custom message
   */
  send(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    if (!this.isConnected) {
      // Queue message for later
      this.messageQueue.push(message);
      this.log('debug', `Message queued: ${type}`, { message });
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.log('debug', `Message sent: ${type}`, { message });
      return true;
    } catch (error) {
      this.log('error', `Failed to send message: ${type}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Handle WebSocket open
   */
  handleOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;

    this.log('info', '✅ WebSocket connected');
    this.emit('connected');

    // Start heartbeat
    this.startHeartbeat();

    // Send queued messages
    this.flushMessageQueue();
  }

  /**
   * Handle WebSocket message
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.log('debug', `Message received: ${message.type}`, { message });

      // Handle system messages
      switch (message.type) {
        case 'system:welcome':
          this.connectionId = message.data.connectionId;
          this.emit('welcome', message.data);
          break;

        case 'system:pong':
          this.lastPong = Date.now();
          break;

        case 'auth:success':
          this.isAuthenticated = true;
          this.user = message.data.user;
          this.log('info', `🔐 Authenticated as: ${this.user.id}`);
          this.emit('authenticated', this.user);
          break;

        case 'error':
          this.log('warn', `Server error: ${message.data.code}`, {
            error: message.data,
          });
          this.emit('error', message.data);
          break;

        default:
          // Emit custom message
          this.emit('message', message);
          this.emit(message.type, message.data);
      }
    } catch (error) {
      this.log('error', 'Failed to parse message', {
        error: error.message,
        data: event.data,
      });
    }
  }

  /**
   * Handle WebSocket close
   */
  handleClose(event) {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.connectionId = null;
    this.user = null;

    this.stopHeartbeat();

    this.log('info', `🔌 WebSocket disconnected`, {
      code: event.code,
      reason: event.reason,
    });
    this.emit('disconnected', { code: event.code, reason: event.reason });

    // Schedule reconnect if needed
    if (this.shouldReconnect && this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  handleError(event) {
    this.log('error', '❌ WebSocket error', { error: event });
    this.emit('connection_error', event);
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('error', 'Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5); // Exponential backoff

    this.log(
      'info',
      `Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.log('info', `Reconnect attempt ${this.reconnectAttempts}`);
      this.emit('reconnecting', this.reconnectAttempts);
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(
      this.sendHeartbeat,
      this.config.heartbeatInterval,
    );
    this.log('debug', 'Heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.log('debug', 'Heartbeat stopped');
    }
  }

  /**
   * Send heartbeat ping
   */
  sendHeartbeat() {
    if (this.isConnected) {
      this.send('system:ping');
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }

    this.log('info', `Sending ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.log('error', `Failed to send queued message: ${message.type}`, {
          error: error.message,
        });
      }
    });
  }

  /**
   * Get client status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      connectionId: this.connectionId,
      user: this.user,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
    };
  }

  /**
   * Logging method
   */
  log(level, message, data = null) {
    if (!this.config.enableLogging) {
      return;
    }

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel] || 1;

    if (levels[level] < currentLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] WebSocket Client: ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }
}

/**
 * Create WebSocket client
 *
 * @param {Object} options - Client configuration
 * @returns {WebSocketClient} WebSocket client instance
 */
export function createWebSocketClient(options = {}) {
  return new WebSocketClient(options);
}
