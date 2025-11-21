/**
 * React Starter Kit WebSocket Server
 *
 * Advanced methods are marked with _underscore and not recommended for direct use.
 */

import { WebSocketServer as WSServer } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

/**
 * WebSocket Server Class
 */
export class WebSocketServer extends EventEmitter {
  /**
   * Create a new WebSocket server instance
   * @param {Object} options - Configuration options
   * @property {number} [options.port=8080] - Port to listen on (standalone mode)
   * @property {string} [options.path='/ws'] - WebSocket endpoint path
   * @property {boolean} [options.enableAuth=false] - Enable JWT authentication
   * @property {string} [options.jwtSecret] - JWT secret (required if enableAuth)
   * @property {boolean} [options.enableLogging=true] - Enable logging
   */
  constructor(options = {}) {
    super();

    // Default configuration
    this.config = {
      port: typeof options.port !== 'undefined' ? options.port : 8080,
      path: typeof options.path !== 'undefined' ? options.path : '/ws',

      enableAuth:
        typeof options.enableAuth !== 'undefined' ? options.enableAuth : false,
      jwtSecret:
        typeof options.jwtSecret !== 'undefined' ? options.jwtSecret : null,

      enableLogging:
        typeof options.enableLogging !== 'undefined'
          ? options.enableLogging
          : true,
    };

    // --- Internal/private advanced config (not part of public API) ---
    this.heartbeatIntervalMs = 30000; // 30 seconds
    this.authTimeoutMs = 10000; // 10 seconds to authenticate
    this.enableBroadcast = true;

    // Server state
    this.server = null;
    this.isRunning = false;
    this.startTime = null;

    // Connection management
    this.connections = new Map(); // connectionId -> WebSocket
    this.userConnections = new Map(); // userId -> Set of connectionIds

    // Heartbeat
    this.heartbeatInterval = null;

    // Bind methods
    this.handleConnection = this.handleConnection.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
    this.heartbeat = this.heartbeat.bind(this);

    this.log('info', 'WebSocket server initialized', { config: this.config });
  }

  /**
   * Start the WebSocket server
   */
  start(httpServer = null) {
    if (this.isRunning) {
      throw new Error('WebSocket server is already running');
    }

    try {
      const serverOptions = {
        path: this.config.path,
        maxPayload: 16 * 1024, // 16KB max message size
      };

      if (httpServer) {
        // Attach to existing HTTP server
        serverOptions.server = httpServer;
        this.log(
          'info',
          `Attaching WebSocket server to HTTP server on path: ${this.config.path}`,
        );
      } else {
        // Create standalone server
        serverOptions.port = this.config.port;
        this.log(
          'info',
          `Starting standalone WebSocket server on port: ${this.config.port}`,
        );
      }

      this.server = new WSServer(serverOptions);
      this.server.on('connection', this.handleConnection);
      this.server.on('error', this.handleError);

      // Start heartbeat
      this.startHeartbeat();

      this.isRunning = true;
      this.startTime = Date.now();

      this.emit('server:started', {
        port: this.config.port,
        path: this.config.path,
        timestamp: new Date().toISOString(),
      });

      this.log('info', 'WebSocket server started successfully', {
        port: this.config.port,
        path: this.config.path,
        features: {
          auth: this.config.enableAuth,
        },
      });

      return this;
    } catch (error) {
      this.log('error', 'Failed to start WebSocket server', {
        error: error && error.message,
      });
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop heartbeat
      this.stopHeartbeat();

      // Close all connections
      this.closeAllConnections();

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
      this.emit('server:stopped', { timestamp: new Date().toISOString() });
      this.log('info', 'WebSocket server stopped successfully');

      return this;
    } catch (error) {
      this.log('error', 'Failed to stop WebSocket server', {
        error: error && error.message,
      });
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
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

    // Store connection
    this.connections.set(connectionId, ws);

    // Setup event handlers
    ws.on('message', data => this.handleMessage(ws, data));
    ws.on('close', (code, reason) => this.handleClose(ws, code, reason));
    ws.on('error', error => this.handleError(ws, error));
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Authentication timeout
    if (this.config.enableAuth) {
      ws.authTimeout = setTimeout(() => {
        if (!ws.authenticated) {
          this.log(
            'warn',
            `Authentication timeout for connection: ${connectionId}`,
          );
          ws.close(1008, 'Authentication timeout');
        }
      }, this.config.authTimeout);
    }

    this.emit('connection:new', ws, req);
    this.log('debug', `New WebSocket connection: ${connectionId}`, {
      ip,
      userAgent: req.headers['user-agent'],
    });

    // Send welcome message
    this.sendToConnection(connectionId, 'system:welcome', {
      connectionId,
      serverTime: new Date().toISOString(),
      features: {
        auth: this.config.enableAuth,
      },
    });

    // If auth is disabled, mark as ready
    if (!this.config.enableAuth) {
      ws.authenticated = true;
      this.emit('connection:ready', ws);
    }
  }

  /**
   * Handle WebSocket message
   */
  async handleMessage(ws, data) {
    try {
      // Parse message
      const message = this.parseMessage(data);
      if (!message) {
        this.sendError(ws, 'invalid_message', 'Invalid message format');
        return;
      }

      this.log('debug', `Message received: ${ws.id} -> ${message.type}`, {
        message,
      });

      // Handle different message types
      switch (message.type) {
        case 'auth:login':
          await this.handleAuthMessage(ws, message);
          break;

        case 'system:ping':
          this.sendToConnection(ws.id, 'system:pong', {
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          // Emit custom message for application handling
          this.emit('message', ws, message);
      }
    } catch (error) {
      this.log('error', `Message handling error: ${ws.id}`, {
        error: error && error.message,
      });
      this.sendError(ws, 'message_error', 'Failed to process message');
    }
  }

  /**
   * Handle authentication message
   */
  async handleAuthMessage(ws, message) {
    if (!this.config.enableAuth) {
      this.sendError(ws, 'auth_disabled', 'Authentication is disabled');
      return;
    }

    if (ws.authenticated) {
      this.sendError(ws, 'already_authenticated', 'Already authenticated');
      return;
    }

    try {
      const { token } = message.data || {};
      if (!token) {
        this.sendError(ws, 'missing_token', 'Authentication token required');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.config.jwtSecret);
      const user = {
        id: decoded.id || decoded.userId || decoded.sub,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || [],
      };

      // Clear auth timeout
      if (ws.authTimeout) {
        clearTimeout(ws.authTimeout);
        ws.authTimeout = null;
      }

      // Mark as authenticated
      ws.authenticated = true;
      ws.user = user;

      // Track user connections
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set());
      }
      this.userConnections.get(user.id).add(ws.id);

      this.emit('connection:authenticated', ws, user);
      this.emit('connection:ready', ws);

      this.log('info', `User authenticated: ${user.id} on connection ${ws.id}`);

      // Send success response
      this.sendToConnection(ws.id, 'auth:success', {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.log('warn', `Authentication failed for connection: ${ws.id}`, {
        error: error && error.message,
      });
      this.sendError(ws, 'auth_failed', 'Invalid authentication token');

      // Close connection after auth failure
      setTimeout(() => {
        ws.close(1008, 'Authentication failed');
      }, 1000);
    }
  }

  /**
   * Handle connection close
   */
  handleClose(ws, code, reason) {
    this.log('debug', `Connection closed: ${ws.id}`, { code, reason });

    // Clear auth timeout
    if (ws.authTimeout) {
      clearTimeout(ws.authTimeout);
    }

    // Remove from user connections
    if (ws.user && this.userConnections.has(ws.user.id)) {
      const userConnections = this.userConnections.get(ws.user.id);
      userConnections.delete(ws.id);
      if (userConnections.size === 0) {
        this.userConnections.delete(ws.user.id);
      }
    }

    // Remove connection
    this.connections.delete(ws.id);

    this.emit('connection:closed', ws, code, reason);
  }

  /**
   * Handle connection error
   */
  handleError(ws, error) {
    this.log('error', `WebSocket error: ${(ws && ws.id) || 'unknown'}`, {
      error: error && error.message,
    });
    this.emit('connection:error', ws, error);
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(
      this.heartbeat,
      this.config.heartbeatInterval,
    );
    this.log('debug', `Heartbeat started (${this.config.heartbeatInterval}ms)`);
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.log('debug', 'Heartbeat stopped');
    }
  }

  /**
   * Heartbeat function - ping all connections
   */
  heartbeat() {
    let deadConnections = 0;

    this.connections.forEach(ws => {
      if (!ws.isAlive) {
        this.log('debug', `Terminating dead connection: ${ws.id}`);
        ws.terminate();
        deadConnections++;
        return;
      }

      ws.isAlive = false;
      ws.ping();
    });

    if (deadConnections > 0) {
      this.log('info', `Cleaned up ${deadConnections} dead connections`);
    }
  }

  /**
   * Send message to specific connection
   */
  sendToConnection(connectionId, type, data) {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === ws.OPEN) {
      const message = this.createMessage(type, data);
      ws.send(message);
      return true;
    }
    return false;
  }

  /**
   * Send message to user (all their connections)
   */
  sendToUser(userId, type, data) {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) {
      return 0;
    }

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
   */
  broadcast(type, data, filter = null) {
    const message = this.createMessage(type, data);
    let sent = 0;

    this.connections.forEach(ws => {
      if (ws.readyState === ws.OPEN && (!filter || filter(ws))) {
        ws.send(message);
        sent++;
      }
    });

    return sent;
  }

  /**
   * Send error message
   */
  sendError(ws, code, message, details = null) {
    this.sendToConnection(ws.id, 'error', {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    this.connections.forEach(ws => {
      ws.close(1001, 'Server shutting down');
    });

    this.connections.clear();
    this.userConnections.clear();
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      connections: {
        total: this.connections.size,
        authenticated: Array.from(this.connections.values()).filter(
          ws => ws.authenticated,
        ).length,
      },
      users: this.userConnections.size,
      config: this.config,
    };
  }

  // Utility methods

  /**
   * Parse WebSocket message
   */
  parseMessage(data) {
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
   */
  createMessage(type, data) {
    return JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });
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
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] WebSocket: ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }
}

/**
 * Create a WebSocket server with sensible defaults.
 *
 * @param {Object} options - Server configuration options
 *   @param {number} [options.port=8080] - Port to listen on (standalone mode)
 *   @param {string} [options.path='/ws'] - WebSocket endpoint path
 *   @param {boolean} [options.enableAuth=false] - Enable JWT authentication
 *   @param {string} [options.jwtSecret] - JWT secret (required if enableAuth)
 *   @param {number} [options.heartbeatInterval=30000] - Heartbeat interval (ms)
 *   @param {boolean} [options.enableLogging=true] - Enable logging
 *   @param {string} [options.logLevel='info'] - Log level
 * @returns {WebSocketServer} - Configured server instance
 */
export function createWebSocketServer(options = {}, httpServer = null) {
  if (options.enableAuth && !options.jwtSecret) {
    console.warn('⚠️ JWT secret not provided, authentication will be disabled');
    options.enableAuth = false;
  }

  const server = new WebSocketServer(options);
  setupDefaultEventHandlers(server); // Internal: always set up sensible logging & lifecycle events
  server.start(httpServer);

  return server;
}

// Internal: always set up sensible event handlers for lifecycle/logging
function setupDefaultEventHandlers(server) {
  server.on('connection:new', (ws, req) => {
    server.log('info', `🔗 New connection: ${ws.id}`, {
      ip: ws.ip,
      userAgent: req.headers['user-agent'],
    });
  });
  server.on('connection:authenticated', (ws, user) => {
    server.log(
      'info',
      `🔐 User authenticated: ${user.id} on connection ${ws.id}`,
    );
  });
  server.on('connection:ready', ws => {
    server.log('info', `✅ Connection ready: ${ws.id}`);
  });
  server.on('connection:closed', (ws, code, reason) => {
    server.log('info', `🔌 Connection closed: ${ws.id}`, { code, reason });
  });
  server.on('connection:error', (ws, error) => {
    server.log('error', `❌ Connection error: ${(ws && ws.id) || 'unknown'}`, {
      error: error && error.message,
    });
  });
  server.on('server:started', info => {
    server.log('info', '🚀 WebSocket server started successfully', {
      port: info.port,
      path: info.path,
      features: {
        auth: server.config.enableAuth,
      },
    });
  });
  server.on('server:stopped', () => {
    server.log('info', '🛑 WebSocket server stopped');
  });
  server.on('message', (ws, message) => {
    server.log('debug', `📨 Custom message: ${ws.id} -> ${message.type}`, {
      message,
    });
  });
}
