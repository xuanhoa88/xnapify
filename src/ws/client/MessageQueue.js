/**
 * WebSocket Message Queue
 * Queues messages when offline and flushes on reconnection
 */

import { EventEmitter } from 'events';
import { DefaultConfig } from '../shared/constants';

export class MessageQueue extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxQueueSize: config.maxQueueSize || DefaultConfig.MESSAGE_QUEUE_SIZE,
      ...config,
    };

    // Message queue
    this.queue = [];
  }

  /**
   * Add message to queue
   * @param {Object} message - Message to queue
   * @returns {boolean} True if queued successfully
   */
  enqueue(message) {
    if (this.queue.length >= this.config.maxQueueSize) {
      this.emit('queue:full', message);
      return false;
    }

    this.queue.push(message);
    this.emit('message:queued', message);
    return true;
  }

  /**
   * Flush all queued messages
   * @param {Function} sendCallback - Callback to send each message
   * @returns {number} Number of messages sent
   */
  flush(sendCallback) {
    if (this.queue.length === 0) {
      return 0;
    }

    const messages = [...this.queue];
    this.queue = [];

    let sent = 0;
    messages.forEach(message => {
      try {
        sendCallback(message);
        sent++;
      } catch (error) {
        this.emit('message:send_failed', message, error);
      }
    });

    this.emit('queue:flushed', sent);
    return sent;
  }

  /**
   * Clear all queued messages
   */
  clear() {
    const count = this.queue.length;
    this.queue = [];
    this.emit('queue:cleared', count);
  }

  /**
   * Get queue size
   * @returns {number} Number of queued messages
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean} True if empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   * @returns {boolean} True if full
   */
  isFull() {
    return this.queue.length >= this.config.maxQueueSize;
  }

  /**
   * Dispose the queue and cleanup resources
   */
  dispose() {
    this.clear();
    this.removeAllListeners();
  }
}
