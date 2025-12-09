/**
 * WebSocket Server - Simplified Implementation
 * Consolidates ConnectionManager, AuthHandler, MessageRouter into a single file
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

import {
  DefaultConfig,
  MessageType,
  ErrorCode,
  EventType as SharedEventType,
  CloseCode,
} from '../shared/constants';
import { createMessage, parseMessage } from '../shared/messages';
import { createLogger } from '../shared/logger';

/**
 * Server-specific event types
 */
const ServerEventType = Object.freeze({
  STARTED: 'started',
  STOPPED: 'stopped',
  CONNECTION: 'connection',
  READY: 'ready',
  CLOSED: 'closed',
});

/**
 * Combined EventType (shared + server-specific)
 */
const EventType = Object.freeze({
  ...SharedEventType,
  ...ServerEventType,
});

/**
 * WebSocket Server Class
 */
export class WebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration - handle false values explicitly
    this.config = {
      path:
        options.path !== undefined ? options.path : DefaultConfig.SERVER_PATH,
      enableAuth: options.enableAuth !== undefined ? options.enableAuth : false,
      requireAuth:
        options.requireAuth !== undefined ? options.requireAuth : false,
      jwtSecret: options.jwtSecret !== undefined ? options.jwtSecret : null,
      authTimeout: options.authTimeout || DefaultConfig.AUTH_TIMEOUT,
      heartbeatInterval:
        options.heartbeatInterval || DefaultConfig.HEARTBEAT_INTERVAL,
      enableLogging:
        options.enableLogging !== undefined
          ? options.enableLogging
          : DefaultConfig.ENABLE_LOGGING,
      logLevel: options.logLevel || DefaultConfig.LOG_LEVEL,
    };

    // Logger
    this.logger = createLogger('WebSocket Server', {
      enableLogging: this.config.enableLogging,
      logLevel: this.config.logLevel,
    });

    // State
    this.server = null;
    this.isRunning = false;
    this.startTime = null;

    // Connection storage
    this.connections = new Map(); // connectionId -> WebSocket
    this.userConnections = new Map(); // userId -> Set<connectionId>
    this.groups = new Map(); // groupId -> Set<connectionId>

    // Auth timeouts
    this.authTimeouts = new Map(); // connectionId -> timeout

    // Message handlers
    this.messageHandlers = new Map();

    // Heartbeat
    this.heartbeatTimer = null;

    // Register default handlers
    // eslint-disable-next-line no-underscore-dangle
    this._registerDefaultHandlers();

    this.logger.info('Server initialized', { config: this.config });
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Start WebSocket server
   */
  start(httpServer = null) {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    this.server = new WebSocket.Server({
      noServer: true,
      maxPayload: DefaultConfig.MAX_PAYLOAD_SIZE,
      perMessageDeflate: false,
    });

    // eslint-disable-next-line no-underscore-dangle
    this.server.on('connection', this._handleConnection.bind(this));
    this.server.on('error', err => {
      this.logger.error('Server error', { error: err.message });
      this.emit('error', err);
    });

    // Handle HTTP upgrade
    if (httpServer) {
      httpServer.on('upgrade', (request, socket, head) => {
        const { pathname } = new URL(
          request.url,
          `http://${request.headers.host}`,
        );
        if (pathname === this.config.path) {
          this.server.handleUpgrade(request, socket, head, ws => {
            this.server.emit('connection', ws, request);
          });
        }
      });
    }

    // Start heartbeat
    this.heartbeatTimer = setInterval(
      // eslint-disable-next-line no-underscore-dangle
      () => this._heartbeat(),
      this.config.heartbeatInterval,
    );

    this.isRunning = true;
    this.startTime = Date.now();

    this.emit(EventType.STARTED, { path: this.config.path });
    this.logger.info('Server started', { path: this.config.path });

    return this;
  }

  /**
   * Stop WebSocket server
   */
  async stop() {
    if (!this.isRunning) return this;

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Clear auth timeouts
    this.authTimeouts.forEach(t => clearTimeout(t));
    this.authTimeouts.clear();

    // Close all connections
    this.connections.forEach(ws =>
      ws.close(CloseCode.GOING_AWAY, 'Server shutting down'),
    );
    this.connections.clear();
    this.userConnections.clear();
    this.groups.clear();

    // Close server
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }

    this.isRunning = false;
    this.emit(EventType.STOPPED);
    this.logger.info('Server stopped');

    return this;
  }

  /**
   * Dispose server and cleanup
   */
  async dispose() {
    await this.stop();
    this.messageHandlers.clear();
    this.removeAllListeners();
  }

  // ============================================================================
  // CONNECTION HANDLING
  // ============================================================================

  /**
   * Handle new connection
   */
  async _handleConnection(ws, req) {
    const connectionId = uuidv4();
    const ip = req.socket.remoteAddress;

    // Setup connection
    ws.id = connectionId;
    ws.ip = ip;
    ws.isAlive = true;
    ws.authenticated = false;
    ws.user = null;
    ws.connectedAt = new Date().toISOString();

    this.connections.set(connectionId, ws);

    // Event handlers
    // eslint-disable-next-line no-underscore-dangle
    ws.on('message', data => this._handleMessage(ws, data));
    // eslint-disable-next-line no-underscore-dangle
    ws.on('close', (code, reason) => this._handleClose(ws, code, reason));
    ws.on('error', err =>
      this.logger.error('Connection error', {
        id: connectionId,
        error: err.message,
      }),
    );
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    this.logger.info(`🔗 New connection: ${connectionId}`, { ip });
    this.emit(EventType.CONNECTION, ws);

    // Send welcome
    setImmediate(async () => {
      // eslint-disable-next-line no-underscore-dangle
      this._send(ws, MessageType.WELCOME, {
        connectionId,
        serverTime: new Date().toISOString(),
        features: { auth: this.config.enableAuth },
        authenticated: false,
      });

      // Auth handling
      if (!this.config.enableAuth) {
        ws.authenticated = true;
        this.emit(EventType.READY, ws);
        return;
      }

      // Try auto-auth from cookies
      // eslint-disable-next-line no-underscore-dangle
      const token = this._extractToken(req);
      if (token) {
        try {
          // eslint-disable-next-line no-underscore-dangle
          await this._authenticate(ws, token);
          return;
        } catch {
          // Cookie auth failed, continue to timeout setup
        }
      }

      // Setup auth timeout if required
      if (this.config.requireAuth) {
        const timeout = setTimeout(() => {
          if (!ws.authenticated) {
            this.logger.warn(`Auth timeout: ${connectionId}`);
            ws.close(CloseCode.POLICY_VIOLATION, 'Authentication timeout');
          }
        }, this.config.authTimeout);
        this.authTimeouts.set(connectionId, timeout);
      } else {
        // Auth optional - mark as ready
        this.emit(EventType.READY, ws);
      }
    });
  }

  /**
   * Handle connection close
   */
  _handleClose(ws, code, reason) {
    this.logger.info(`🔌 Connection closed: ${ws.id}`, {
      code,
      reason: reason ? reason.toString() : undefined,
    });

    // Clear auth timeout
    const timeout = this.authTimeouts.get(ws.id);
    if (timeout) {
      clearTimeout(timeout);
      this.authTimeouts.delete(ws.id);
    }

    // Remove from user connections
    if (ws.user) {
      const userConns = this.userConnections.get(ws.user.id);
      if (userConns) {
        userConns.delete(ws.id);
        if (userConns.size === 0) this.userConnections.delete(ws.user.id);
      }
    }

    // Remove from groups
    this.groups.forEach((members, groupId) => {
      members.delete(ws.id);
      if (members.size === 0) this.groups.delete(groupId);
    });

    this.connections.delete(ws.id);
    this.emit(EventType.CLOSED, ws, code, reason);
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Extract token from cookies
   */
  _extractToken(req) {
    const { cookie } = req.headers;
    if (!cookie) return null;

    const cookies = cookie.split(';').reduce((acc, c) => {
      const [k, v] = c.trim().split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    return cookies.id_token || cookies.auth_token || null;
  }

  /**
   * Authenticate connection
   */
  async _authenticate(ws, token) {
    if (!this.config.enableAuth) {
      throw new Error('Authentication is disabled');
    }

    if (ws.authenticated) {
      throw new Error('Already authenticated');
    }

    if (!token) {
      throw new Error('Token required');
    }

    const decoded = jwt.verify(token, this.config.jwtSecret);
    const user = {
      id: decoded.id || decoded.userId || decoded.sub,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };

    // Clear auth timeout
    const timeout = this.authTimeouts.get(ws.id);
    if (timeout) {
      clearTimeout(timeout);
      this.authTimeouts.delete(ws.id);
    }

    ws.authenticated = true;
    ws.user = user;

    // Track user connections
    if (!this.userConnections.has(user.id)) {
      this.userConnections.set(user.id, new Set());
    }
    this.userConnections.get(user.id).add(ws.id);

    this.logger.info(`🔐 Authenticated: ${user.id} on ${ws.id}`);
    this.emit(EventType.AUTHENTICATED, ws, user);
    this.emit(EventType.READY, ws);

    return user;
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Register default message handlers
   */
  _registerDefaultHandlers() {
    // Ping/Pong
    this.messageHandlers.set(MessageType.PING, ws => {
      // eslint-disable-next-line no-underscore-dangle
      this._send(ws, MessageType.PONG, {
        timestamp: new Date().toISOString(),
      });
    });

    // Auth login
    this.messageHandlers.set(MessageType.AUTH_LOGIN, async (ws, message) => {
      try {
        // eslint-disable-next-line no-underscore-dangle
        const user = await this._authenticate(
          ws,
          message.data && message.data.token,
        );
        // eslint-disable-next-line no-underscore-dangle
        this._send(ws, MessageType.AUTH_SUCCESS, {
          user: { id: user.id, email: user.email, role: user.role },
        });
      } catch (err) {
        this.logger.warn(`Auth failed: ${ws.id}`, { error: err.message });
        // eslint-disable-next-line no-underscore-dangle
        this._sendError(ws, ErrorCode.AUTH_FAILED, err.message);
        setTimeout(
          () => ws.close(CloseCode.POLICY_VIOLATION, 'Auth failed'),
          1000,
        );
      }
    });
  }

  /**
   * Handle incoming message
   */
  async _handleMessage(ws, data) {
    const message = parseMessage(data);
    if (!message) {
      // eslint-disable-next-line no-underscore-dangle
      this._sendError(ws, ErrorCode.INVALID_MESSAGE, 'Invalid message format');
      return;
    }

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        await handler(ws, message);
      } catch (err) {
        this.logger.error('Handler error', {
          type: message.type,
          error: err.message,
        });
        // eslint-disable-next-line no-underscore-dangle
        this._sendError(
          ws,
          ErrorCode.MESSAGE_ERROR,
          'Failed to process message',
        );
      }
    } else {
      // Emit for application handling
      this.emit(EventType.MESSAGE, ws, message);
    }
  }

  /**
   * Register custom message handler
   */
  registerHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Unregister message handler
   */
  unregisterHandler(type) {
    this.messageHandlers.delete(type);
  }

  // ============================================================================
  // SENDING MESSAGES
  // ============================================================================

  /**
   * Send message to connection
   */
  _send(ws, type, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(createMessage(type, data));
    return true;
  }

  /**
   * Send error message
   */
  _sendError(ws, code, message) {
    // eslint-disable-next-line no-underscore-dangle
    this._send(ws, 'error', { code, message });
  }

  /**
   * Send to specific connection
   */
  sendToConnection(connectionId, type, data) {
    const ws = this.connections.get(connectionId);
    // eslint-disable-next-line no-underscore-dangle
    return this._send(ws, type, data);
  }

  /**
   * Send to user (all their connections)
   */
  sendToUser(userId, type, data) {
    const conns = this.userConnections.get(userId);
    if (!conns) return 0;

    let sent = 0;
    conns.forEach(id => {
      if (this.sendToConnection(id, type, data)) sent++;
    });
    return sent;
  }

  /**
   * Send to group
   */
  sendToGroup(groupId, type, data) {
    const conns = this.groups.get(groupId);
    if (!conns) return 0;

    let sent = 0;
    conns.forEach(id => {
      if (this.sendToConnection(id, type, data)) sent++;
    });
    return sent;
  }

  /**
   * Broadcast to all connections
   */
  broadcast(type, data, filter = null) {
    const message = createMessage(type, data);
    let sent = 0;

    this.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN && (!filter || filter(ws))) {
        ws.send(message);
        sent++;
      }
    });

    return sent;
  }

  // ============================================================================
  // GROUPS
  // ============================================================================

  /**
   * Add connection to group
   */
  joinGroup(connectionId, groupId) {
    if (!this.connections.has(connectionId)) return false;

    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, new Set());
    }
    this.groups.get(groupId).add(connectionId);
    return true;
  }

  /**
   * Remove connection from group
   */
  leaveGroup(connectionId, groupId) {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const removed = group.delete(connectionId);
    if (group.size === 0) this.groups.delete(groupId);
    return removed;
  }

  /**
   * Get group members
   */
  getGroupConnections(groupId) {
    return this.groups.get(groupId) || new Set();
  }

  // ============================================================================
  // HEARTBEAT
  // ============================================================================

  /**
   * Heartbeat - ping all connections
   */
  _heartbeat() {
    this.connections.forEach(ws => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }

  // ============================================================================
  // STATS
  // ============================================================================

  /**
   * Get server statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      connections: {
        total: this.connections.size,
        authenticated: [...this.connections.values()].filter(
          ws => ws.authenticated,
        ).length,
      },
      users: this.userConnections.size,
      groups: this.groups.size,
    };
  }
}

/**
 * Factory function
 */
export function createWebSocketServer(options = {}, httpServer = null) {
  if (options.enableAuth && !options.jwtSecret) {
    console.warn('⚠️ JWT secret not provided, disabling authentication');
    options.enableAuth = false;
  }

  const server = new WebSocketServer(options);
  server.start(httpServer);
  return server;
}

// Re-export types for convenience
export { EventType };
export { MessageType, CloseCode } from '../shared/constants';
