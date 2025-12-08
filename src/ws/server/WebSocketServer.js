/**
 * React Starter Kit WebSocket Server
 * Refactored to use modular components
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import {
  DefaultConfig,
  MessageType,
  ErrorCode,
  EventType,
  CloseCode,
} from '../shared/constants';
import { createMessage } from '../shared/messages';
import { createLogger } from '../shared/logger';
import { ServerError } from '../shared/errors';

import { ConnectionManager } from './ConnectionManager';
import { AuthHandler } from './AuthHandler';
import { MessageRouter } from './MessageRouter';

/**
 * WebSocket Server Class
 */
export class WebSocketServer extends EventEmitter {
  /**
   * Create a new WebSocket server instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      port: options.port || DefaultConfig.SERVER_PORT,
      path: options.path || DefaultConfig.SERVER_PATH,
      enableAuth: options.enableAuth || false,
      jwtSecret: options.jwtSecret || null,
      enableLogging: options.enableLogging || DefaultConfig.ENABLE_LOGGING,
      logLevel: options.logLevel || DefaultConfig.LOG_LEVEL,
      heartbeatInterval:
        options.heartbeatInterval || DefaultConfig.HEARTBEAT_INTERVAL,
      authTimeout: options.authTimeout || DefaultConfig.AUTH_TIMEOUT,
    };

    // Create logger
    this.logger = createLogger('WebSocket Server', {
      enableLogging: this.config.enableLogging,
      logLevel: this.config.logLevel,
    });

    // Create managers
    this.connectionManager = new ConnectionManager({
      heartbeatInterval: this.config.heartbeatInterval,
    });

    this.authHandler = new AuthHandler({
      enableAuth: this.config.enableAuth,
      jwtSecret: this.config.jwtSecret,
      authTimeout: this.config.authTimeout,
    });

    this.messageRouter = new MessageRouter();

    // Server state
    this.server = null;
    this.isRunning = false;
    this.startTime = null;

    // Setup event forwarding
    this.setupEventForwarding();

    // Register message handlers
    this.registerMessageHandlers();

    this.logger.info('WebSocket server initialized', { config: this.config });
  }

  /**
   * Setup event forwarding from managers
   */
  setupEventForwarding() {
    // Forward connection manager events
    this.connectionManager.on(EventType.CONNECTION_NEW, ws => {
      this.emit(EventType.CONNECTION_NEW, ws);
    });

    this.connectionManager.on('heartbeat:cleanup', count => {
      this.logger.info(`Cleaned up ${count} dead connections`);
    });

    // Forward auth handler events
    this.authHandler.on(EventType.CONNECTION_AUTHENTICATED, (ws, user) => {
      this.connectionManager.associateUser(ws.id, user);
      this.emit(EventType.CONNECTION_AUTHENTICATED, ws, user);
      this.emit(EventType.CONNECTION_READY, ws);
      this.logger.info(`User authenticated: ${user.id} on connection ${ws.id}`);
    });

    this.authHandler.on('auth:timeout', ws => {
      this.logger.warn(`Authentication timeout for connection: ${ws.id}`);
    });

    // Forward message router events
    this.messageRouter.on('message:received', (ws, message) => {
      this.logger.debug(`Message received: ${ws.id} -> ${message.type}`, {
        message,
      });
    });

    this.messageRouter.on('message:invalid', ws => {
      this.logger.warn(`Invalid message from ${ws.id}`);
      this.messageRouter.sendError(
        ws,
        ErrorCode.INVALID_MESSAGE,
        'Invalid message format',
      );
    });

    this.messageRouter.on('message:error', (ws, message, error) => {
      this.logger.error(`Message handling error: ${ws.id}`, {
        error: error && error.message,
        message,
      });
      this.messageRouter.sendError(
        ws,
        ErrorCode.MESSAGE_ERROR,
        'Failed to process message',
      );
    });

    this.messageRouter.on('message:custom', (ws, message) => {
      this.emit(EventType.MESSAGE, ws, message);
    });
  }

  /**
   * Register message handlers
   */
  registerMessageHandlers() {
    // Register auth handler
    this.messageRouter.registerHandler(
      MessageType.AUTH_LOGIN,
      this.handleAuthMessage.bind(this),
    );
  }

  /**
   * Start the WebSocket server
   * @param {Object} httpServer - Optional HTTP server to attach to
   * @returns {WebSocketServer} This instance
   */
  start(httpServer = null) {
    if (this.isRunning) {
      throw new ServerError('WebSocket server is already running', {
        status: 409,
      });
    }

    try {
      const serverOptions = {
        noServer: true, // Handle upgrade manually for path routing
        maxPayload: DefaultConfig.MAX_PAYLOAD_SIZE,
        perMessageDeflate: false, // Disable compression for compatibility
      };

      this.server = new WebSocket.Server(serverOptions);
      this.server.on('connection', this.handleConnection.bind(this));
      this.server.on('error', this.handleServerError.bind(this));

      // Handle upgrade manually to allow other WebSocket servers (like BrowserSync)
      if (httpServer) {
        const wsPath = this.config.path;
        httpServer.on('upgrade', (request, socket, head) => {
          const { pathname } = new URL(
            request.url,
            `http://${request.headers.host}`,
          );

          // Only handle our path, let other WebSocket servers handle their paths
          if (pathname === wsPath) {
            this.server.handleUpgrade(request, socket, head, ws => {
              this.server.emit('connection', ws, request);
            });
          }
          // Don't destroy the socket for other paths - let them be handled by other servers
        });
        this.logger.info(
          `Attached WebSocket server to HTTP server on path: ${wsPath}`,
        );
      } else {
        this.logger.warn(
          'No HTTP server provided. WebSocket server running in noServer mode.',
        );
      }

      // Start heartbeat
      this.connectionManager.startHeartbeat();

      this.isRunning = true;
      this.startTime = Date.now();

      this.emit(EventType.SERVER_STARTED, {
        port: this.config.port,
        path: this.config.path,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('WebSocket server started successfully', {
        port: this.config.port,
        path: this.config.path,
        features: {
          auth: this.config.enableAuth,
        },
      });

      return this;
    } catch (error) {
      this.logger.error('Failed to start WebSocket server', {
        error: error && error.message,
      });
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   * @returns {Promise<WebSocketServer>} This instance
   */
  async stop() {
    if (!this.isRunning) {
      return this;
    }

    try {
      // Stop heartbeat
      this.connectionManager.stopHeartbeat();

      // Close all connections
      this.connectionManager.closeAll();

      // Cleanup auth handler
      this.authHandler.cleanup();

      // Close server
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close(error => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      this.isRunning = false;
      this.emit(EventType.SERVER_STOPPED, {
        timestamp: new Date().toISOString(),
      });
      this.logger.info('WebSocket server stopped successfully');

      return this;
    } catch (error) {
      this.logger.error('Failed to stop WebSocket server', {
        error: error && error.message,
      });
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket instance
   * @param {Object} req - HTTP request
   */
  async handleConnection(ws, req) {
    const ip = req.socket.remoteAddress;
    const connectionId = uuidv4();

    // Setup connection
    ws.id = connectionId;
    ws.ip = ip;
    ws.isAlive = true;
    ws.authenticated = false;
    ws.user = null;
    ws.connectedAt = new Date().toISOString();

    // Add to connection manager
    this.connectionManager.addConnection(connectionId, ws);

    // Setup event handlers
    ws.on('message', data => this.messageRouter.route(ws, data));
    ws.on('close', (code, reason) => this.handleClose(ws, code, reason));
    ws.on('error', error => this.handleConnectionError(ws, error));
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    this.logger.debug(`New WebSocket connection: ${connectionId}`, {
      ip,
      user_agent: req.headers['user-agent'],
    });

    // Use setImmediate to ensure WebSocket is fully ready
    setImmediate(async () => {
      // Send welcome message first
      this.sendToConnection(connectionId, MessageType.SYSTEM_WELCOME, {
        connectionId,
        serverTime: new Date().toISOString(),
        features: {
          auth: this.config.enableAuth,
        },
        authenticated: false,
      });

      // If auth is disabled, mark as ready
      if (!this.authHandler.isEnabled()) {
        ws.authenticated = true;
        this.emit(EventType.CONNECTION_READY, ws);
        return;
      }

      // Try to auto-authenticate using JWT from cookies
      const token = this.extractTokenFromCookies(req);
      if (token) {
        try {
          const user = await this.authHandler.authenticate(ws, token);
          this.logger.info(`Auto-authenticated via cookie: ${user.id}`);

          // Send auth success message
          this.sendToConnection(connectionId, MessageType.AUTH_SUCCESS, {
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
            },
            authenticated: true,
          });
        } catch (error) {
          // Cookie auth failed - setup timeout
          this.logger.debug('Cookie auth failed:', error.message);
          this.authHandler.setupAuthTimeout(ws);
        }
      } else {
        // No cookie - setup auth timeout
        this.authHandler.setupAuthTimeout(ws);
      }
    });
  }

  /**
   * Extract JWT token from request cookies
   * @param {Object} req - HTTP request
   * @returns {string|null} JWT token or null
   */
  extractTokenFromCookies(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    // Parse cookies - look for 'id_token' or 'auth_token'
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {});

    return cookies.id_token || cookies.auth_token || null;
  }

  /**
   * Handle authentication message
   * @param {WebSocket} ws - WebSocket instance
   * @param {Object} message - Message object
   */
  async handleAuthMessage(ws, message) {
    try {
      const { token } = message.data || {};
      const user = await this.authHandler.authenticate(ws, token);

      // Send success response
      this.sendToConnection(ws.id, MessageType.AUTH_SUCCESS, {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(`Authentication failed for connection: ${ws.id}`, {
        error: error && error.message,
      });

      this.messageRouter.sendError(
        ws,
        (error && error.details && error.details.code) || ErrorCode.AUTH_FAILED,
        (error && error.message) || 'Authentication failed',
      );

      // Close connection after auth failure
      setTimeout(() => {
        ws.close(CloseCode.POLICY_VIOLATION, 'Authentication failed');
      }, 1000);
    }
  }

  /**
   * Handle connection close
   * @param {WebSocket} ws - WebSocket instance
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  handleClose(ws, code, reason) {
    this.logger.debug(`Connection closed: ${ws.id}`, { code, reason });

    // Clear auth timeout
    this.authHandler.clearAuthTimeout(ws.id);

    // Remove connection
    this.connectionManager.removeConnection(ws.id);

    this.emit(EventType.CONNECTION_CLOSED, ws, code, reason);
  }

  /**
   * Handle connection error
   * @param {WebSocket} ws - WebSocket instance
   * @param {Error} error - Error object
   */
  handleConnectionError(ws, error) {
    this.logger.error(`WebSocket error: ${(ws && ws.id) || 'unknown'}`, {
      error: error && error.message,
    });
    this.emit(EventType.CONNECTION_ERROR, ws, error);
  }

  /**
   * Handle server error
   * @param {Error} error - Error object
   */
  handleServerError(error) {
    this.logger.error('WebSocket server error', {
      error: error && error.message,
    });
    this.emit('error', error);
  }

  /**
   * Send message to specific connection
   * @param {string} connectionId - Connection ID
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {boolean} True if sent successfully
   */
  sendToConnection(connectionId, type, data) {
    const ws = this.connectionManager.getConnection(connectionId);
    return this.messageRouter.sendMessage(ws, type, data);
  }

  /**
   * Send message to user (all their connections)
   * @param {string} userId - User ID
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {number} Number of connections sent to
   */
  sendToUser(userId, type, data) {
    const userConnections = this.connectionManager.getUserConnections(userId);
    let sent = 0;

    userConnections.forEach(connectionId => {
      if (this.sendToConnection(connectionId, type, data)) {
        sent++;
      }
    });

    return sent;
  }

  /**
   * Broadcast to all connections
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @param {Function} filter - Optional filter function (ws) => boolean
   * @returns {number} Number of connections sent to
   */
  broadcast(type, data, filter = null) {
    const message = createMessage(type, data);
    let sent = 0;

    this.connectionManager.getAllConnections().forEach(ws => {
      if (ws.readyState === WebSocket.OPEN && (!filter || filter(ws))) {
        ws.send(message);
        sent++;
      }
    });

    return sent;
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    this.connectionManager.closeAll();
  }

  /**
   * Get server statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const connStats = this.connectionManager.getStats();

    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      connections: {
        total: connStats.totalConnections,
        authenticated: connStats.authenticatedConnections,
      },
      users: connStats.totalUsers,
      config: this.config,
    };
  }

  /**
   * Register custom message handler
   * @param {string} messageType - Message type
   * @param {Function} handler - Handler function
   */
  registerMessageHandler(messageType, handler) {
    this.messageRouter.registerHandler(messageType, handler);
  }

  /**
   * Unregister message handler
   * @param {string} messageType - Message type
   */
  unregisterMessageHandler(messageType) {
    this.messageRouter.unregisterHandler(messageType);
  }

  /**
   * Dispose server and cleanup all resources
   */
  async dispose() {
    await this.stop();

    // Dispose all managers
    this.connectionManager.dispose();
    this.authHandler.dispose();
    this.messageRouter.dispose();

    // Remove own listeners
    this.removeAllListeners();

    this.logger.info('WebSocket server disposed');
  }
}

/**
 * Create a WebSocket server with sensible defaults
 * @param {Object} options - Server configuration options
 * @param {Object} httpServer - Optional HTTP server
 * @returns {WebSocketServer} Configured server instance
 */
export function createWebSocketServer(options = {}, httpServer = null) {
  if (options.enableAuth && !options.jwtSecret) {
    console.warn('⚠️ JWT secret not provided, authentication will be disabled');
    options.enableAuth = false;
  }

  const server = new WebSocketServer(options);
  setupDefaultEventHandlers(server);
  server.start(httpServer);

  return server;
}

/**
 * Setup default event handlers for lifecycle/logging
 * @param {WebSocketServer} server - Server instance
 */
function setupDefaultEventHandlers(server) {
  server.on(EventType.CONNECTION_NEW, ws => {
    server.logger.info(`🔗 New connection: ${ws.id}`, {
      ip: ws.ip,
    });
  });

  server.on(EventType.CONNECTION_AUTHENTICATED, (ws, user) => {
    server.logger.info(
      `🔐 User authenticated: ${user.id} on connection ${ws.id}`,
    );
  });

  server.on(EventType.CONNECTION_READY, ws => {
    server.logger.info(`✅ Connection ready: ${ws.id}`);
  });

  server.on(EventType.CONNECTION_CLOSED, (ws, code, reason) => {
    server.logger.info(`🔌 Connection closed: ${ws.id}`, { code, reason });
  });

  server.on(EventType.CONNECTION_ERROR, (ws, error) => {
    server.logger.error(`❌ Connection error: ${(ws && ws.id) || 'unknown'}`, {
      error: error && error.message,
    });
  });

  server.on(EventType.SERVER_STARTED, info => {
    server.logger.info('🚀 WebSocket server started successfully', {
      port: info.port,
      path: info.path,
      features: {
        auth: server.config.enableAuth,
      },
    });
  });

  server.on(EventType.SERVER_STOPPED, () => {
    server.logger.info('🛑 WebSocket server stopped');
  });

  server.on(EventType.MESSAGE, (ws, message) => {
    server.logger.debug(`📨 Custom message: ${ws.id} -> ${message.type}`, {
      message,
    });
  });
}
