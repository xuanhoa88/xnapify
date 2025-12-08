/**
 * WebSocket Connection Manager
 * Manages WebSocket connections, user tracking, and heartbeat
 */

import { EventEmitter } from 'events';
import { EventType, CloseCode } from '../shared/constants';

export class ConnectionManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000,
      ...config,
    };

    // Connection storage
    this.connections = new Map(); // connectionId -> WebSocket
    this.userConnections = new Map(); // userId -> Set of connectionIds

    // Heartbeat
    this.heartbeatInterval = null;

    // Bind methods
    this.heartbeat = this.heartbeat.bind(this);
  }

  /**
   * Add a new connection
   * @param {string} connectionId - Unique connection ID
   * @param {WebSocket} ws - WebSocket instance
   */
  addConnection(connectionId, ws) {
    this.connections.set(connectionId, ws);
    this.emit(EventType.CONNECTION_NEW, ws);
  }

  /**
   * Remove a connection
   * @param {string} connectionId - Connection ID to remove
   */
  removeConnection(connectionId) {
    const ws = this.connections.get(connectionId);
    if (!ws) {
      return;
    }

    // Remove from user connections
    if (ws.user && this.userConnections.has(ws.user.id)) {
      const userConnections = this.userConnections.get(ws.user.id);
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(ws.user.id);
      }
    }

    // Clear stale references
    ws.user = null;
    ws.authenticated = false;

    this.connections.delete(connectionId);
  }

  /**
   * Get connection by ID
   * @param {string} connectionId - Connection ID
   * @returns {WebSocket|undefined} WebSocket instance
   */
  getConnection(connectionId) {
    return this.connections.get(connectionId);
  }

  /**
   * Associate connection with user
   * @param {string} connectionId - Connection ID
   * @param {Object} user - User object
   */
  associateUser(connectionId, user) {
    const ws = this.connections.get(connectionId);
    if (!ws) {
      return;
    }

    ws.user = user;

    if (!this.userConnections.has(user.id)) {
      this.userConnections.set(user.id, new Set());
    }
    this.userConnections.get(user.id).add(connectionId);
  }

  /**
   * Get all connections for a user
   * @param {string} userId - User ID
   * @returns {Set<string>} Set of connection IDs
   */
  getUserConnections(userId) {
    return this.userConnections.get(userId) || new Set();
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
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Heartbeat function - ping all connections
   */
  heartbeat() {
    let deadConnections = 0;

    this.connections.forEach(ws => {
      if (!ws.isAlive) {
        ws.terminate();
        deadConnections++;
        return;
      }

      ws.isAlive = false;
      ws.ping();
    });

    if (deadConnections > 0) {
      this.emit('heartbeat:cleanup', deadConnections);
    }
  }

  /**
   * Close all connections
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  closeAll(code = CloseCode.NORMAL, reason = 'Server shutting down') {
    this.connections.forEach(ws => {
      ws.close(code, reason);
    });

    this.connections.clear();
    this.userConnections.clear();
  }

  /**
   * Get connection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      authenticatedConnections: Array.from(this.connections.values()).filter(
        ws => ws.authenticated,
      ).length,
      totalUsers: this.userConnections.size,
    };
  }

  /**
   * Get all connections
   * @returns {Map} All connections
   */
  getAllConnections() {
    return this.connections;
  }

  /**
   * Dispose the manager and cleanup resources
   */
  dispose() {
    this.stopHeartbeat();
    this.closeAll();
    this.removeAllListeners();
  }
}
