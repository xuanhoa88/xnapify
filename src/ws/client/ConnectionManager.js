/**
 * WebSocket Client Connection Manager
 * Manages WebSocket connection lifecycle and state
 */

import { EventEmitter } from 'events';
import { ConnectionState, EventType } from '../shared/constants';

export class ConnectionManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      url: config.url,
      ...config,
    };

    // Connection state
    this.ws = null;
    this.state = ConnectionState.DISCONNECTED;
    this.connectionId = null;
    this.messageHandler = null;

    // Bind methods
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      this.state = ConnectionState.CONNECTING;
      this.ws = new WebSocket(this.config.url);

      this.ws.addEventListener('open', this.handleOpen);
      this.ws.addEventListener('close', this.handleClose);
      this.ws.addEventListener('error', this.handleError);

      // Attach message handler if already registered
      if (this.messageHandler) {
        this.ws.addEventListener('message', this.messageHandler);
      }

      this.emit('connecting');
    } catch (error) {
      this.state = ConnectionState.FAILED;
      this.emit('connection:failed', error);
    }
  }

  /**
   * Disconnect from WebSocket server
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  disconnect(code = 1000, reason = 'Client disconnect') {
    this.state = ConnectionState.DISCONNECTING;

    if (this.ws) {
      // Clean up event listeners
      this.ws.removeEventListener('open', this.handleOpen);
      this.ws.removeEventListener('close', this.handleClose);
      this.ws.removeEventListener('error', this.handleError);
      if (this.messageHandler) {
        this.ws.removeEventListener('message', this.messageHandler);
      }
      this.ws.close(code, reason);
      this.ws = null;
    }

    this.connectionId = null;
    this.state = ConnectionState.DISCONNECTED;
  }

  /**
   * Handle WebSocket open
   */
  handleOpen() {
    this.state = ConnectionState.CONNECTED;
    this.emit(EventType.CONNECTED);
  }

  /**
   * Handle WebSocket close
   * @param {CloseEvent} event - Close event
   */
  handleClose(event) {
    this.state = ConnectionState.DISCONNECTED;
    this.connectionId = null;

    this.emit(EventType.DISCONNECTED, {
      code: event.code,
      reason: event.reason,
    });
  }

  /**
   * Handle WebSocket error
   * @param {Event} event - Error event
   */
  handleError(event) {
    this.emit(EventType.CONNECTION_ERROR_CLIENT, event);
  }

  /**
   * Get WebSocket instance
   * @returns {WebSocket} WebSocket instance
   */
  getWebSocket() {
    return this.ws;
  }

  /**
   * Check if connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return (
      this.state === ConnectionState.CONNECTED &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    );
  }

  /**
   * Get connection state
   * @returns {string} Connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Set connection ID
   * @param {string} id - Connection ID
   */
  setConnectionId(id) {
    this.connectionId = id;
  }

  /**
   * Get connection ID
   * @returns {string} Connection ID
   */
  getConnectionId() {
    return this.connectionId;
  }

  /**
   * Add message listener
   * @param {Function} handler - Message handler
   */
  addMessageListener(handler) {
    this.messageHandler = handler;
    if (this.ws) {
      this.ws.addEventListener('message', handler);
    }
  }

  /**
   * Remove message listener
   * @param {Function} handler - Message handler
   */
  removeMessageListener(handler) {
    if (this.messageHandler === handler) {
      this.messageHandler = null;
    }
    if (this.ws) {
      this.ws.removeEventListener('message', handler);
    }
  }

  /**
   * Send data through WebSocket
   * @param {string} data - Data to send
   * @returns {boolean} True if sent successfully
   */
  send(data) {
    if (this.isConnected()) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  /**
   * Dispose the connection manager and cleanup resources
   */
  dispose() {
    this.disconnect();
    this.messageHandler = null;
    this.removeAllListeners();
  }
}
