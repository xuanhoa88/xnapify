/**
 * WebSocket Heartbeat Manager
 * Manages periodic heartbeat pings to keep connection alive
 */

import { EventEmitter } from 'events';
import { DefaultConfig } from '../shared/constants';

export class HeartbeatManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      heartbeatInterval:
        config.heartbeatInterval || DefaultConfig.HEARTBEAT_INTERVAL,
      ...config,
    };

    // Heartbeat state
    this.heartbeatTimer = null;
    this.lastPong = null;
  }

  /**
   * Start heartbeat
   * @param {Function} sendCallback - Callback to send heartbeat ping
   */
  start(sendCallback) {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      sendCallback();
      this.emit('heartbeat:sent');
    }, this.config.heartbeatInterval);

    this.emit('heartbeat:started');
  }

  /**
   * Stop heartbeat
   */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.emit('heartbeat:stopped');
    }
  }

  /**
   * Record pong received
   */
  recordPong() {
    this.lastPong = Date.now();
    this.emit('heartbeat:pong');
  }

  /**
   * Get last pong timestamp
   * @returns {number|null} Timestamp or null
   */
  getLastPong() {
    return this.lastPong;
  }

  /**
   * Check if heartbeat is active
   * @returns {boolean} True if active
   */
  isActive() {
    return this.heartbeatTimer !== null;
  }

  /**
   * Get time since last pong
   * @returns {number|null} Milliseconds since last pong, or null
   */
  getTimeSinceLastPong() {
    if (!this.lastPong) {
      return null;
    }
    return Date.now() - this.lastPong;
  }

  /**
   * Dispose the manager and cleanup resources
   */
  dispose() {
    this.stop();
    this.lastPong = null;
    this.removeAllListeners();
  }
}
