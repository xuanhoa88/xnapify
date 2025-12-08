/**
 * WebSocket Reconnection Handler
 * Handles automatic reconnection with exponential backoff
 */

import { EventEmitter } from 'events';
import { DefaultConfig } from '../shared/constants';

export class ReconnectionHandler extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      autoReconnect: config.autoReconnect || DefaultConfig.AUTO_RECONNECT,
      reconnectInterval:
        config.reconnectInterval || DefaultConfig.RECONNECT_INTERVAL,
      maxReconnectAttempts:
        config.maxReconnectAttempts || DefaultConfig.MAX_RECONNECT_ATTEMPTS,
      ...config,
    };

    // Reconnection state
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
  }

  /**
   * Schedule reconnection attempt
   * @param {Function} connectCallback - Callback to execute for reconnection
   */
  scheduleReconnect(connectCallback) {
    if (!this.shouldReconnect || !this.config.autoReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff (capped at 5x the base interval)
    const delay =
      this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5);

    this.emit('reconnect_scheduled', {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.emit('reconnecting', this.reconnectAttempts);
      connectCallback();
    }, delay);
  }

  /**
   * Cancel scheduled reconnection
   */
  cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Reset reconnection attempts
   */
  reset() {
    this.reconnectAttempts = 0;
    this.cancelReconnect();
  }

  /**
   * Disable reconnection
   */
  disable() {
    this.shouldReconnect = false;
    this.cancelReconnect();
  }

  /**
   * Enable reconnection
   */
  enable() {
    this.shouldReconnect = true;
  }

  /**
   * Get reconnection attempts
   * @returns {number} Number of attempts
   */
  getAttempts() {
    return this.reconnectAttempts;
  }

  /**
   * Check if reconnection is enabled
   * @returns {boolean} True if enabled
   */
  isEnabled() {
    return this.shouldReconnect && this.config.autoReconnect;
  }

  /**
   * Dispose the handler and cleanup resources
   */
  dispose() {
    this.cancelReconnect();
    this.removeAllListeners();
  }
}
