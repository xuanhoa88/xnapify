/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';

import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import {
  DefaultConfig,
  MessageType,
  ErrorCode,
  EventType as SharedEventType,
  CloseCode,
  ChannelType,
  createMessage,
  parseMessage,
  createLogger,
} from '../utils/index.js';

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
class WebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration - handle false values explicitly
    this.config = {
      path: options.path != null ? options.path : DefaultConfig.SERVER_PATH,
      authTimeout: options.authTimeout || DefaultConfig.AUTH_TIMEOUT,
      onAuthentication:
        typeof options.onAuthentication === 'function'
          ? options.onAuthentication
          : null,
      heartbeatInterval:
        options.heartbeatInterval || DefaultConfig.HEARTBEAT_INTERVAL,
      enableLogging:
        options.enableLogging != null
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

    // Channel storage
    this.channels = new Map(); // channelName -> { type, subscribers: Set<connectionId>, metadata }
    this.connectionChannels = new Map(); // connectionId -> Set<channelName>

    // Auth timeouts
    this.authTimeouts = new Map(); // connectionId -> timeout

    // Message handlers
    this.messageHandlers = new Map();

    // Heartbeat
    this.heartbeatTimer = null;
    // Cross-instance fan-out (see attachPubSub)
    this.pubsub = null;
    // Backstop for dropped revocation events (see startRevocationSweep)
    this.revocationSweepTimer = null;

    // Register default handlers
    // eslint-disable-next-line no-underscore-dangle
    this._registerDefaultHandlers();

    this.logger.info('🚀 Server initialized', { config: this.config });
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Start WebSocket server
   */
  start(httpServer = null) {
    if (this.isRunning) {
      const err = new Error('Server is already running');
      err.name = 'ServerAlreadyRunningError';
      err.status = 400;
      throw err;
    }

    this.server = new WebSocket.Server({
      noServer: true,
      maxPayload: DefaultConfig.MAX_PAYLOAD_SIZE,
      perMessageDeflate: false,
    });

    // eslint-disable-next-line no-underscore-dangle
    this.server.on('connection', this._handleConnection.bind(this));
    this.server.on('error', err => {
      this.logger.error('❌ Server error', { error: err.message });
      this.emit('error', err);
    });

    // Handle HTTP upgrade
    if (httpServer) {
      // eslint-disable-next-line no-underscore-dangle
      this._httpServer = httpServer;
      // eslint-disable-next-line no-underscore-dangle
      this._upgradeHandler = (request, socket, head) => {
        const { pathname } = new URL(
          request.url,
          `http://${request.headers.host}`,
        );
        if (pathname === this.config.path) {
          this.server.handleUpgrade(request, socket, head, ws => {
            this.server.emit('connection', ws, request);
          });
        }
      };
      // eslint-disable-next-line no-underscore-dangle
      httpServer.on('upgrade', this._upgradeHandler);
    }

    // Start heartbeat
    this.heartbeatTimer = setInterval(
      // eslint-disable-next-line no-underscore-dangle
      () => this._heartbeat(),
      this.config.heartbeatInterval,
    );

    this.isRunning = true;
    this.startTime = Date.now();

    // Initialize default channels
    this.createPublicChannel({
      description: 'Public channel for all connections',
    });
    this.createProtectedChannel({
      description: 'Protected channel for authenticated users',
    });

    this.emit(EventType.STARTED, { path: this.config.path });

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

    // Stop the revocation backstop
    this.stopRevocationSweep();

    // Remove HTTP upgrade listener
    // eslint-disable-next-line no-underscore-dangle
    if (this._httpServer && this._upgradeHandler) {
      // eslint-disable-next-line no-underscore-dangle
      this._httpServer.removeListener('upgrade', this._upgradeHandler);
      // eslint-disable-next-line no-underscore-dangle
      this._httpServer = null;
      // eslint-disable-next-line no-underscore-dangle
      this._upgradeHandler = null;
    }

    // Clear auth timeouts
    this.authTimeouts.forEach(t => clearTimeout(t));
    this.authTimeouts.clear();

    // Close all connections
    this.connections.forEach(ws =>
      ws.close(CloseCode.GOING_AWAY, 'Server shutting down'),
    );
    this.connections.clear();
    this.channels.clear();
    this.connectionChannels.clear();

    // Close server
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }

    this.isRunning = false;
    this.emit(EventType.STOPPED);
    this.logger.info('🛑 Server stopped');

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
      this.logger.error('❌ Connection error', {
        id: connectionId,
        error: err.message,
      }),
    );
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    this.logger.info(`🔗 New connection: ${connectionId}`, { ip });
    this.emit(EventType.CONNECTION, ws);

    // Auto-subscribe to public channel
    // eslint-disable-next-line no-underscore-dangle
    this._subscribeToChannel(ws, ChannelType.PUBLIC);

    // Send welcome immediately (minimal - just connection info)
    // eslint-disable-next-line no-underscore-dangle
    this._send(ws, MessageType.WELCOME, {
      connectionId,
      serverTime: new Date().toISOString(),
    });

    // Auto-authenticate from cookies if token present
    // eslint-disable-next-line no-underscore-dangle
    await this._tryAutoAuthenticate(ws, req);

    this.emit(EventType.READY, ws);
  }

  /**
   * Try to auto-authenticate from cookies in upgrade request
   * This handles already-authenticated users opening a new WS connection
   */
  async _tryAutoAuthenticate(ws, req) {
    if (!this.config.onAuthentication) {
      return; // No auth callback configured
    }

    // Parse cookies from request headers
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return;
    }

    // Extract id_token from cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const token = cookies[this.config.jwtCookieName || 'id_token'];
    if (!token) {
      return;
    }

    try {
      // eslint-disable-next-line no-underscore-dangle
      const user = await this._authenticate(ws, token);

      if (user) {
        this.logger.info(
          `🔐 Auto-authentication succeeded using cookie for connection ${ws.id} and user ${user.id}`,
        );
        // Send auth success to client
        // eslint-disable-next-line no-underscore-dangle
        this._send(ws, MessageType.AUTH_SUCCESS, { user });
      }
    } catch (err) {
      // Silent fail - user will need to authenticate manually
      this.logger.debug(
        `Auto-authentication failed for connection ${ws.id}: ${err.message}`,
      );
    }
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

    // Remove from all channels
    const connectionChannels = this.connectionChannels.get(ws.id);
    if (connectionChannels) {
      connectionChannels.forEach(channelName => {
        const channel = this.channels.get(channelName);
        if (channel) {
          channel.subscribers.delete(ws.id);
        }
      });
      this.connectionChannels.delete(ws.id);
    }

    this.connections.delete(ws.id);
    this.emit(EventType.CLOSED, ws, code, reason);
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Authenticate connection
   */
  async _authenticate(ws, token) {
    if (ws.authenticated) {
      // eslint-disable-next-line no-underscore-dangle
      this._send(ws, MessageType.AUTH_SUCCESS, { user: ws.user });
      return;
    }

    let user;

    if (typeof this.config.onAuthentication === 'function') {
      try {
        user = await this.config.onAuthentication(token, ws.id);
      } catch (err) {
        // eslint-disable-next-line no-underscore-dangle
        this._sendAuthFailed(
          ws,
          ErrorCode.AUTHENTICATION_FAILED,
          `Authentication failed: ${err.message}`,
        );
        return;
      }
    } else {
      // Fallback or warning if no auth handler provided
      // eslint-disable-next-line no-underscore-dangle
      this._sendAuthFailed(
        ws,
        ErrorCode.AUTHENTICATION_NOT_CONFIGURED,
        'Authentication handler not configured',
      );
      return;
    }

    if (!user || !user.id) {
      // eslint-disable-next-line no-underscore-dangle
      this._sendAuthFailed(
        ws,
        ErrorCode.INVALID_AUTHENTICATION_RESULT,
        `Invalid user returned from authentication handler. The user must include the '#id' property.`,
      );
      return;
    }

    // Clear auth timeout
    const timeout = this.authTimeouts.get(ws.id);
    if (timeout) {
      clearTimeout(timeout);
      this.authTimeouts.delete(ws.id);
    }

    ws.authenticated = true;
    ws.user = user;

    // Auto-subscribe to protected channel
    // eslint-disable-next-line no-underscore-dangle
    this._subscribeToChannel(ws, ChannelType.PROTECTED);

    // Create and subscribe to private user channel
    this.createPrivateChannel(user.id);
    // eslint-disable-next-line no-underscore-dangle
    this._subscribeToChannel(ws, `user:${user.id}`);

    this.emit(EventType.AUTHENTICATED, ws, user);

    return user;
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Register default message handlers
   */
  _registerDefaultHandlers() {
    // eslint-disable-next-line no-underscore-dangle
    this.messageHandlers.set(MessageType.PING, ws => this._handlePing(ws));

    this.messageHandlers.set(MessageType.AUTH_LOGIN, (ws, msg) =>
      // eslint-disable-next-line no-underscore-dangle
      this._handleAuthLogin(ws, msg),
    );

    this.messageHandlers.set(MessageType.AUTH_LOGOUT, ws =>
      // eslint-disable-next-line no-underscore-dangle
      this._handleAuthLogout(ws),
    );

    this.messageHandlers.set(MessageType.CHANNEL_SUBSCRIBE, (ws, msg) =>
      // eslint-disable-next-line no-underscore-dangle
      this._handleChannelSubscribe(ws, msg),
    );

    this.messageHandlers.set(MessageType.CHANNEL_UNSUBSCRIBE, (ws, msg) =>
      // eslint-disable-next-line no-underscore-dangle
      this._handleChannelUnsubscribe(ws, msg),
    );
  }

  /**
   * Handle Ping
   */
  _handlePing(ws) {
    // eslint-disable-next-line no-underscore-dangle
    this._send(ws, MessageType.PONG, {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle Auth Login
   */
  async _handleAuthLogin(ws, message) {
    try {
      // eslint-disable-next-line no-underscore-dangle
      const user = await this._authenticate(
        ws,
        message.data && message.data.token,
      );

      if (!user) {
        // _authenticate already sent error
        return;
      }

      // eslint-disable-next-line no-underscore-dangle
      this._send(ws, MessageType.AUTH_SUCCESS, { user });
    } catch (err) {
      this.logger.warn(`🔒 Auth failed: ${ws.id}`, { error: err.message });
      // eslint-disable-next-line no-underscore-dangle
      this._sendAuthFailed(ws, ErrorCode.AUTHENTICATION_FAILED, err.message);
      setTimeout(
        () => ws.close(CloseCode.POLICY_VIOLATION, 'Auth failed'),
        1000,
      );
    }
  }

  /**
   * Handle Auth Logout
   */
  _handleAuthLogout(ws) {
    if (!ws.authenticated) {
      this.logger.warn(
        `⚠️ Logout attempt from unauthenticated connection: ${ws.id}`,
      );
      return;
    }

    const { user } = ws;

    // Unsubscribe from protected channel
    // eslint-disable-next-line no-underscore-dangle
    this._unsubscribeFromChannel(ws, ChannelType.PROTECTED);

    // Unsubscribe from private user channel
    if (user && user.id) {
      // eslint-disable-next-line no-underscore-dangle
      this._unsubscribeFromChannel(ws, `user:${user.id}`);
    }

    // Clear auth state
    ws.authenticated = false;
    ws.user = null;

    this.logger.info(`🔓 Logged out: ${ws.id}`);

    // Emit unauthenticated event
    this.emit(EventType.UNAUTHENTICATED, ws, { reason: 'logout' });
  }

  /**
   * Handle Channel Subscribe
   */
  _handleChannelSubscribe(ws, message) {
    const channelName = message && message.data && message.data.channel;
    if (!channelName) {
      // eslint-disable-next-line no-underscore-dangle
      this._sendError(
        ws,
        ErrorCode.CHANNEL_NAME_REQUIRED,
        'Channel name required',
      );
      return;
    }

    const channel = this.channels.get(channelName);
    if (!channel) {
      // eslint-disable-next-line no-underscore-dangle
      this._sendError(
        ws,
        ErrorCode.CHANNEL_NOT_FOUND,
        `Channel not found: ${channelName}`,
      );
      return;
    }

    // Check access based on channel type
    if (channel.type === ChannelType.PROTECTED && !ws.authenticated) {
      // eslint-disable-next-line no-underscore-dangle
      this._sendError(
        ws,
        ErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required',
      );
      return;
    }

    if (channel.type === ChannelType.PRIVATE) {
      const expectedUserId = channel.metadata && channel.metadata.userId;
      if (!ws.user || ws.user.id !== expectedUserId) {
        // eslint-disable-next-line no-underscore-dangle
        this._sendError(ws, ErrorCode.ACCESS_DENIED, 'Access denied');
        return;
      }
    }

    // eslint-disable-next-line no-underscore-dangle
    this._subscribeToChannel(ws, channelName);
    // eslint-disable-next-line no-underscore-dangle
    this._send(ws, MessageType.CHANNEL_SUBSCRIBED, {
      channel: channelName,
      type: channel.type,
    });
  }

  /**
   * Handle Channel Unsubscribe
   */
  _handleChannelUnsubscribe(ws, message) {
    const channelName = message.data && message.data.channel;
    if (!channelName) {
      // eslint-disable-next-line no-underscore-dangle
      this._sendError(
        ws,
        ErrorCode.CHANNEL_NAME_REQUIRED,
        'Channel name required',
      );
      return;
    }

    // eslint-disable-next-line no-underscore-dangle
    this._unsubscribeFromChannel(ws, channelName);
    // eslint-disable-next-line no-underscore-dangle
    this._send(ws, MessageType.CHANNEL_UNSUBSCRIBED, {
      channel: channelName,
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
        this.logger.error('❌ Handler error', {
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
   * Send auth failed message
   */
  _sendAuthFailed(ws, code, message) {
    // eslint-disable-next-line no-underscore-dangle
    this._send(ws, MessageType.AUTH_FAILED, { code, message });
    this.emit(EventType.UNAUTHENTICATED, ws, { code, message });
  }

  /**
   * Close every connection matching a predicate.
   * Used by session revocation: sockets were authenticated once at connect
   * time, so a revoked session must be cut off explicitly.
   *
   * @param {Function} predicate - (ws) => boolean
   * @param {string} [reason='Session revoked']
   * @param {number} [code=CloseCode.POLICY_VIOLATION]
   * @returns {number} Connections closed
   */
  closeConnections(
    predicate,
    reason = 'Session revoked',
    code = CloseCode.POLICY_VIOLATION,
  ) {
    let closed = 0;
    this.connections.forEach(ws => {
      let match = false;
      try {
        match = !!predicate(ws);
      } catch {
        match = false;
      }
      if (!match) return;
      try {
        ws.close(code, reason);
        closed += 1;
      } catch {
        // socket already closing
      }
    });
    return closed;
  }

  /**
   * Close every authenticated connection belonging to a user.
   * @param {string|number} userId
   * @param {string} [reason]
   * @returns {number}
   */
  disconnectUser(userId, reason, { local = false } = {}) {
    if (userId === undefined || userId === null) return 0;
    if (!local) {
      // eslint-disable-next-line no-underscore-dangle
      this._publish({ op: 'disconnectUser', userId, reason });
    }
    const target = String(userId);
    return this.closeConnections(
      ws => ws.user && String(ws.user.id) === target,
      reason,
    );
  }

  /**
   * Close every connection opened with an access token of one session.
   * Requires the authentication handler to expose the token's `sid` claim
   * on the user object.
   * @param {string} sid - Session (refresh-token family) id
   * @param {string} [reason]
   * @returns {number}
   */
  disconnectSession(sid, reason, { local = false } = {}) {
    if (!sid) return 0;
    if (!local) {
      // eslint-disable-next-line no-underscore-dangle
      this._publish({ op: 'disconnectSession', sid, reason });
    }
    return this.closeConnections(ws => ws.user && ws.user.sid === sid, reason);
  }

  // ============================================================================
  // CROSS-INSTANCE FAN-OUT
  // ============================================================================

  /**
   * Share channel messages and disconnects with every other server instance
   * through Redis pub/sub. Each worker holds its own connections; without
   * this, a message sent from worker A never reaches a browser connected to
   * worker B, and a session revoked on A stays open on B.
   *
   * Redis does NOT apply a client's `keyPrefix` to PUBLISH/SUBSCRIBE, and
   * pub/sub is not scoped to a database either — so two deployments sharing
   * one Redis with different key prefixes would still share a literal
   * channel name. The default therefore borrows the publisher's `keyPrefix`
   * so each deployment gets its own channel.
   *
   * @param {Object} options
   * @param {Object} options.publisher - ioredis-compatible client
   * @param {Object} options.subscriber - Dedicated subscriber client
   * @param {string} [options.channel] - Pub/sub channel name
   *   (defaults to `<publisher keyPrefix>ws:events`)
   * @param {string} [options.instanceId] - Unique id of this process
   * @returns {Promise<void>}
   */
  async attachPubSub({
    publisher,
    subscriber,
    channel = `${publisher?.options?.keyPrefix ?? ''}ws:events`,
    instanceId = `${process.pid}:${uuidv4()}`,
  }) {
    if (!publisher || typeof publisher.publish !== 'function') {
      throw new TypeError('attachPubSub requires a publisher client');
    }
    if (!subscriber || typeof subscriber.subscribe !== 'function') {
      throw new TypeError('attachPubSub requires a subscriber client');
    }

    const onMessage = (incomingChannel, raw) => {
      if (incomingChannel !== channel) return;
      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }
      if (!event || event.origin === instanceId) return;
      // eslint-disable-next-line no-underscore-dangle
      this._applyRemoteEvent(event);
    };

    subscriber.on('message', onMessage);
    try {
      await subscriber.subscribe(channel);
    } catch (error) {
      // Never leave a half-attached pubsub behind: a truthy `this.pubsub`
      // makes _publish write into a client nobody is listening on and
      // silences the "Channel not found" warning that would reveal it.
      if (typeof subscriber.off === 'function') {
        subscriber.off('message', onMessage);
      }
      throw error;
    }
    // Committed only once the subscription actually exists.
    this.pubsub = { publisher, subscriber, channel, instanceId, onMessage };
    this.logger.info(`🔁 Fan-out enabled on "${channel}" as ${instanceId}`);
  }

  /**
   * Stop sharing events with other instances.
   * @returns {Promise<void>}
   */
  async detachPubSub() {
    if (!this.pubsub) return;
    const { subscriber, channel, onMessage } = this.pubsub;
    this.pubsub = null;
    // The listener must go too: subscriber clients are shared and long-lived,
    // so a later re-attach would otherwise apply every remote event twice.
    if (onMessage && typeof subscriber.off === 'function') {
      subscriber.off('message', onMessage);
    }
    try {
      await subscriber.unsubscribe(channel);
    } catch {
      // subscriber already closed
    }
  }

  _publish(event) {
    if (!this.pubsub) return;
    const { publisher, channel, instanceId } = this.pubsub;
    const payload = JSON.stringify({ ...event, origin: instanceId });
    Promise.resolve(publisher.publish(channel, payload)).catch(err => {
      // Redis pub/sub has no replay. A dropped channel broadcast is a lost
      // notification; a dropped disconnect leaves a revoked session's socket
      // open on every other instance until the revocation sweep catches it.
      if (event.op === 'disconnectUser' || event.op === 'disconnectSession') {
        this.logger.error(
          `🚨 Revocation fan-out failed (${event.op}): ${err.message} — ` +
            'sockets on other instances stay open until the next revocation sweep',
        );
        return;
      }
      this.logger.error(`Fan-out publish failed (${event.op}): ${err.message}`);
    });
  }

  // ============================================================================
  // REVOCATION SWEEP
  // ============================================================================

  /**
   * Periodically re-check authenticated sockets against a revocation
   * predicate and close the ones whose session is gone.
   *
   * Fan-out is fire-and-forget over a transport with no replay, so a lost
   * `disconnectSession` event would otherwise leave a revoked socket open on
   * the other instances forever. This sweep is the self-healing backstop.
   *
   * @param {(sid: string) => boolean|Promise<boolean>} isRevoked
   * @param {Object} [options]
   * @param {number} [options.intervalMs=60000]
   * @param {string} [options.reason='Session revoked']
   * @returns {this}
   */
  startRevocationSweep(
    isRevoked,
    { intervalMs = 60_000, reason = 'Session revoked' } = {},
  ) {
    if (typeof isRevoked !== 'function') {
      throw new TypeError('startRevocationSweep requires a predicate function');
    }
    this.stopRevocationSweep();
    this.revocationSweepTimer = setInterval(() => {
      this.sweepRevokedSessions(isRevoked, reason).catch(err => {
        this.logger.error(`Revocation sweep failed: ${err.message}`);
      });
    }, intervalMs);
    if (typeof this.revocationSweepTimer.unref === 'function') {
      this.revocationSweepTimer.unref();
    }
    return this;
  }

  /** Stop the periodic revocation sweep. */
  stopRevocationSweep() {
    if (this.revocationSweepTimer) {
      clearInterval(this.revocationSweepTimer);
      this.revocationSweepTimer = null;
    }
    return this;
  }

  /**
   * Run one revocation sweep over the live connections.
   *
   * @param {(sid: string) => boolean|Promise<boolean>} isRevoked
   * @param {string} [reason]
   * @returns {Promise<number>} Connections closed
   */
  async sweepRevokedSessions(isRevoked, reason = 'Session revoked') {
    const sids = new Set();
    this.connections.forEach(ws => {
      if (ws.user && ws.user.sid) sids.add(String(ws.user.sid));
    });

    let closed = 0;
    for (const sid of sids) {
      let revoked = false;
      try {
        revoked = await isRevoked(sid);
      } catch (err) {
        // Store unavailable — leave the socket alone rather than closing
        // every session because Redis blipped.
        this.logger.warn(`Revocation sweep check failed: ${err.message}`);
        continue;
      }
      // `local` — the revocation is already known everywhere; re-publishing
      // it from every instance would multiply one kill into N.
      if (revoked)
        closed += this.disconnectSession(sid, reason, { local: true });
    }
    return closed;
  }

  _applyRemoteEvent(event) {
    switch (event.op) {
      case 'channel':
        this.sendToChannel(event.channelName, event.type, event.data, {
          local: true,
        });
        break;
      case 'disconnectUser':
        this.disconnectUser(event.userId, event.reason, { local: true });
        break;
      case 'disconnectSession':
        this.disconnectSession(event.sid, event.reason, { local: true });
        break;
      default:
        this.logger.debug(`Ignoring unknown fan-out op: ${event.op}`);
    }
  }

  /**
   * Send to specific connection.
   *
   * LOCAL ONLY BY DESIGN — this is not fanned out over pub/sub. A connection
   * id only means something on the instance that accepted the socket, so a
   * remote instance could not act on it. Reach a user or a session across
   * instances with {@link sendToPrivateChannel} / {@link sendToChannel}.
   */
  sendToConnection(connectionId, type, data) {
    const ws = this.connections.get(connectionId);
    // eslint-disable-next-line no-underscore-dangle
    return this._send(ws, type, data);
  }

  /**
   * Broadcast to all connections.
   *
   * LOCAL ONLY BY DESIGN — this reaches the sockets held by THIS instance,
   * not the whole deployment, and the optional `filter` is a function that
   * cannot be serialised over pub/sub. For a deployment-wide broadcast use
   * {@link sendToPublicChannel}, which is fanned out.
   */
  broadcast(type, data, filter = null) {
    const message = createMessage(type, data);
    let sent = 0;

    this.connections.forEach(ws => {
      if (
        ws.readyState === WebSocket.OPEN &&
        (typeof filter === 'function' ? filter(ws) : true)
      ) {
        ws.send(message);
        sent++;
      }
    });

    return sent;
  }

  // ============================================================================
  // CHANNELS
  // ============================================================================

  /**
   * Create a new channel
   */
  _createChannel(name, type = ChannelType.PUBLIC, metadata = {}) {
    if (this.channels.has(name)) {
      this.logger.warn(`⚠️ Channel already exists: ${name}`);
      return false;
    }

    this.channels.set(name, {
      type,
      subscribers: new Set(),
      metadata,
      createdAt: new Date().toISOString(),
    });

    this.logger.info(`📢 Channel created: ${name} (${type})`);
    return true;
  }

  /**
   * Create a private channel
   */
  createPrivateChannel(userId, metadata = {}) {
    // eslint-disable-next-line no-underscore-dangle
    return this._createChannel(`user:${userId}`, ChannelType.PRIVATE, {
      ...metadata,
      userId,
    });
  }

  /**
   * Create a protected channel
   */
  createProtectedChannel(metadata = {}) {
    // eslint-disable-next-line no-underscore-dangle
    return this._createChannel(ChannelType.PROTECTED, ChannelType.PROTECTED, {
      ...metadata,
      protected: true,
    });
  }

  /**
   * Create a public channel
   */
  createPublicChannel(metadata = {}) {
    // eslint-disable-next-line no-underscore-dangle
    return this._createChannel(ChannelType.PUBLIC, ChannelType.PUBLIC, {
      ...metadata,
      public: true,
    });
  }

  /**
   * Delete a channel
   */
  deleteChannel(name) {
    const channel = this.channels.get(name);
    if (!channel) return false;

    // Notify subscribers before deletion
    channel.subscribers.forEach(connectionId => {
      const ws = this.connections.get(connectionId);
      if (ws) {
        // eslint-disable-next-line no-underscore-dangle
        this._send(ws, MessageType.CHANNEL_UNSUBSCRIBED, {
          channel: name,
          reason: 'Channel deleted',
        });
      }

      // Remove from connection's channel list
      const connectionChannels = this.connectionChannels.get(connectionId);
      if (connectionChannels) {
        connectionChannels.delete(name);
      }
    });

    this.channels.delete(name);
    this.logger.info(`📢 Channel deleted: ${name}`);
    return true;
  }

  /**
   * Get channel info
   */
  getChannel(name) {
    const channel = this.channels.get(name);
    if (!channel) return null;

    return {
      name,
      type: channel.type,
      subscriberCount: channel.subscribers.size,
      metadata: channel.metadata,
      createdAt: channel.createdAt,
    };
  }

  /**
   * Get all channels
   */
  getChannels() {
    const result = [];
    this.channels.forEach((channel, name) => {
      result.push({
        name,
        type: channel.type,
        subscriberCount: channel.subscribers.size,
      });
    });
    return result;
  }

  /**
   * Internal: Subscribe connection to channel
   */
  _subscribeToChannel(ws, channelName) {
    const channel = this.channels.get(channelName);
    if (!channel) return false;

    // Add to channel subscribers
    channel.subscribers.add(ws.id);

    // Track in connection's channels
    if (!this.connectionChannels.has(ws.id)) {
      this.connectionChannels.set(ws.id, new Set());
    }
    this.connectionChannels.get(ws.id).add(channelName);

    this.logger.debug(`Subscribed ${ws.id} to channel ${channelName}`);
    return true;
  }

  /**
   * Internal: Unsubscribe connection from channel
   */
  _unsubscribeFromChannel(ws, channelName) {
    const channel = this.channels.get(channelName);
    if (!channel) return false;

    // Remove from channel subscribers
    channel.subscribers.delete(ws.id);

    // Remove from connection's channels
    const connectionChannels = this.connectionChannels.get(ws.id);
    if (connectionChannels) {
      connectionChannels.delete(channelName);
    }

    this.logger.debug(`Unsubscribed ${ws.id} from channel ${channelName}`);
    return true;
  }

  /**
   * Get channel subscribers
   */
  getChannelSubscribers(channelName) {
    const channel = this.channels.get(channelName);
    return channel ? channel.subscribers : new Set();
  }

  /**
   * Get channels a connection is subscribed to
   */
  getConnectionChannels(connectionId) {
    return this.connectionChannels.get(connectionId) || new Set();
  }

  /**
   * Send message to a channel
   */
  sendToChannel(channelName, type, data, { local = false } = {}) {
    // Fan out first so subscribers on other workers receive it even when
    // this worker holds no local subscriber for the channel.
    if (!local) {
      // eslint-disable-next-line no-underscore-dangle
      this._publish({ op: 'channel', channelName, type, data });
    }
    const channel = this.channels.get(channelName);
    if (!channel) {
      if (!this.pubsub) {
        this.logger.warn(`⚠️ Channel not found: ${channelName}`);
      }
      return 0;
    }

    const message = createMessage(MessageType.CHANNEL_MESSAGE, {
      channel: channelName,
      type,
      data,
    });

    let sent = 0;
    channel.subscribers.forEach(connectionId => {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sent++;
      }
    });

    this.logger.debug(`Sent to channel ${channelName}: ${sent} recipients`);
    return sent;
  }

  /**
   * Convenience: Send to public channel (all connections)
   */
  sendToPublicChannel(type, data) {
    return this.sendToChannel(ChannelType.PUBLIC, type, data);
  }

  /**
   * Convenience: Send to protected channel (authenticated users)
   */
  sendToProtectedChannel(type, data) {
    return this.sendToChannel(ChannelType.PROTECTED, type, data);
  }

  /**
   * Convenience: Send to user's private channel
   */
  sendToPrivateChannel(userId, type, data) {
    return this.sendToChannel(`user:${userId}`, type, data);
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
      channels: this.channels.size,
    };
  }
}

/**
 * Factory function
 */
export function createWebSocketServer(options = {}, httpServer = null) {
  const server = new WebSocketServer(options);
  server.start(httpServer);
  return server;
}

// Export the class for tests and custom hosting
export { WebSocketServer };

// Re-export types for convenience
export { EventType, MessageType, CloseCode, ChannelType };
