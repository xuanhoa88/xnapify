/**
 * WebSocket Message Router
 * Routes messages to appropriate handlers
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { MessageType } from '../shared/constants';
import { parseMessage, createMessage } from '../shared/messages';

export class MessageRouter extends EventEmitter {
  constructor() {
    super();

    // Message handlers
    this.handlers = new Map();

    // Register default system handlers
    this.registerHandler(MessageType.SYSTEM_PING, this.handlePing.bind(this));
  }

  /**
   * Register a message handler
   * @param {string} messageType - Message type to handle
   * @param {Function} handler - Handler function (ws, message) => void
   */
  registerHandler(messageType, handler) {
    this.handlers.set(messageType, handler);
  }

  /**
   * Unregister a message handler
   * @param {string} messageType - Message type
   */
  unregisterHandler(messageType) {
    this.handlers.delete(messageType);
  }

  /**
   * Route incoming message to appropriate handler
   * @param {WebSocket} ws - WebSocket instance
   * @param {string|Buffer} data - Raw message data
   * @returns {Promise<void>}
   */
  async route(ws, data) {
    // Parse message
    const message = parseMessage(data);
    if (!message) {
      this.emit('message:invalid', ws, data);
      return;
    }

    this.emit('message:received', ws, message);

    // Check for registered handler
    const handler = this.handlers.get(message.type);
    if (handler) {
      try {
        await handler(ws, message);
      } catch (error) {
        this.emit('message:error', ws, message, error);
      }
    } else {
      // Emit as custom message for application handling
      this.emit('message:custom', ws, message);
    }
  }

  /**
   * Handle ping message
   * @param {WebSocket} ws - WebSocket instance
   */
  handlePing(ws) {
    const response = createMessage(MessageType.SYSTEM_PONG, {
      timestamp: new Date().toISOString(),
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(response);
    }
  }

  /**
   * Send message to connection
   * @param {WebSocket} ws - WebSocket instance
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {boolean} True if sent successfully
   */
  sendMessage(ws, type, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message = createMessage(type, data);
    ws.send(message);
    return true;
  }

  /**
   * Send error message
   * @param {WebSocket} ws - WebSocket instance
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  sendError(ws, code, message, details = null) {
    this.sendMessage(ws, MessageType.ERROR, {
      code,
      message,
      details,
    });
  }

  /**
   * Dispose the router and cleanup resources
   */
  dispose() {
    this.handlers.clear();
    this.removeAllListeners();
  }
}
