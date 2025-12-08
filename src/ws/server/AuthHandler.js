/**
 * WebSocket Authentication Handler
 * Handles JWT authentication and user session management
 */

import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import { ErrorCode, EventType, CloseCode } from '../shared/constants';
import { AuthenticationError } from '../shared/errors';

export class AuthHandler extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      enableAuth: config.enableAuth || false,
      jwtSecret: config.jwtSecret || null,
      authTimeout: config.authTimeout || 10000,
      ...config,
    };

    // Track auth timeouts
    this.authTimeouts = new Map(); // connectionId -> timeout
  }

  /**
   * Setup authentication timeout for a connection
   * @param {WebSocket} ws - WebSocket instance
   */
  setupAuthTimeout(ws) {
    if (!this.config.enableAuth) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!ws.authenticated) {
        this.emit('auth:timeout', ws);
        ws.close(CloseCode.POLICY_VIOLATION, 'Authentication timeout');
      }
    }, this.config.authTimeout);

    this.authTimeouts.set(ws.id, timeout);
  }

  /**
   * Clear authentication timeout
   * @param {string} connectionId - Connection ID
   */
  clearAuthTimeout(connectionId) {
    const timeout = this.authTimeouts.get(connectionId);
    if (timeout) {
      clearTimeout(timeout);
      this.authTimeouts.delete(connectionId);
    }
  }

  /**
   * Authenticate a connection with JWT token
   * @param {WebSocket} ws - WebSocket instance
   * @param {string} token - JWT token
   * @returns {Object} User object
   * @throws {AuthenticationError} If authentication fails
   */
  async authenticate(ws, token) {
    if (!this.config.enableAuth) {
      throw new AuthenticationError('Authentication is disabled');
    }

    if (ws.authenticated) {
      throw new AuthenticationError('Already authenticated');
    }

    if (!token) {
      throw new AuthenticationError('Authentication token required', {
        code: ErrorCode.MISSING_TOKEN,
      });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.config.jwtSecret);
      const user = {
        id: decoded.id || decoded.userId || decoded.sub,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || [],
      };

      // Clear auth timeout
      this.clearAuthTimeout(ws.id);

      // Mark as authenticated
      ws.authenticated = true;
      ws.user = user;

      this.emit(EventType.CONNECTION_AUTHENTICATED, ws, user);

      return user;
    } catch (error) {
      throw new AuthenticationError('Invalid authentication token', {
        code: ErrorCode.AUTH_FAILED,
        originalError: error.message,
      });
    }
  }

  /**
   * Check if authentication is enabled
   * @returns {boolean} True if enabled
   */
  isEnabled() {
    return this.config.enableAuth;
  }

  /**
   * Cleanup handler (clear all timeouts)
   */
  cleanup() {
    this.authTimeouts.forEach(timeout => clearTimeout(timeout));
    this.authTimeouts.clear();
  }

  /**
   * Dispose the handler and cleanup resources
   */
  dispose() {
    this.cleanup();
    this.removeAllListeners();
  }
}
