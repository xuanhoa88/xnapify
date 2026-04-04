/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Channel - Pub/sub wrapper for a queue
 *
 * Provides event-based interface: on(event, handler), emit(event, data)
 */
export class Channel {
  constructor(name, queue) {
    this.name = name || 'default';
    this.queue = queue;
    this.handlers = new Map();
    this.isProcessing = false;
  }

  /**
   * Register an event handler
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler function
   * @returns {Channel} This channel for chaining
   */
  on(eventName, handler) {
    // Validate inputs
    if (!eventName || typeof eventName !== 'string') {
      console.error(
        `Channel '${this.name}': Event name must be a non-empty string`,
      );
      return this;
    }

    if (typeof handler !== 'function') {
      console.error(`Channel '${this.name}': Handler must be a function`);
      return this;
    }

    try {
      if (this.handlers.has(eventName)) {
        console.warn(
          `Channel '${this.name}': Overwriting existing handler for '${eventName}'`,
        );
      }
      this.handlers.set(eventName, handler);
      console.info(
        `✅ Channel '${this.name}': Registered handler for '${eventName}'`,
      );

      if (!this.isProcessing) {
        this.startProcessing();
      }
    } catch (error) {
      console.error(`❌ Channel '${this.name}': on() failed:`, error.message);
    }

    return this;
  }

  /**
   * Remove an event handler
   * @param {string} eventName - Event name
   * @returns {Channel} This channel for chaining
   */
  off(eventName) {
    const deleted = this.handlers.delete(eventName);
    if (deleted) {
      console.info(
        `✅ Channel '${this.name}': Removed handler for '${eventName}'`,
      );
    }
    return this;
  }

  /**
   * Emit an event (adds job to queue)
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @param {Object} options - Job options
   * @returns {Promise<Object|null>} Job or null on failure
   */
  async emit(eventName, data = {}, options = {}) {
    if (!eventName || typeof eventName !== 'string' || !this.queue) return null;

    try {
      return await this.queue.add(eventName, data, options);
    } catch (error) {
      console.error(`Channel '${this.name}': emit failed:`, error.message);
      return null;
    }
  }

  /**
   * Emit multiple events
   * @param {Array} events - Array of {event, data, options}
   * @returns {Promise<Array>} Array of jobs (nulls filtered)
   */
  async emitBulk(events = []) {
    if (!Array.isArray(events)) return [];

    const jobs = await Promise.all(
      events.map(({ event, data, options }) => this.emit(event, data, options)),
    );
    return jobs.filter(Boolean);
  }

  /**
   * Start processing jobs
   * @private
   */
  startProcessing() {
    if (!this.queue || typeof this.queue.process !== 'function') {
      console.error(`Channel '${this.name}': queue.process not available`);
      return;
    }

    this.isProcessing = true;

    try {
      this.queue.process(async job => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          // Throw so the adapter retries instead of silently consuming the job
          throw new Error(
            `No handler registered for '${job.name}' on channel '${this.name}'`,
          );
        }

        try {
          return await handler(job);
        } catch (error) {
          console.error(
            `Channel '${this.name}': handler '${job.name}' error:`,
            error.message,
          );
          throw error; // Re-throw for retry logic
        }
      });
    } catch (error) {
      console.error(
        `Channel '${this.name}': startProcessing failed:`,
        error.message,
      );
      this.isProcessing = false;
    }
  }

  /**
   * Check if a handler exists for an event
   * @param {string} eventName - Event name
   * @returns {boolean} True if handler exists
   */
  hasHandler(eventName) {
    return this.handlers.has(eventName);
  }

  /**
   * Get number of registered handlers
   * @returns {number} Number of handlers
   */
  getHandlerCount() {
    return this.handlers.size;
  }

  /**
   * Get channel stats
   * @returns {Promise<Object>} Channel statistics
   */
  async getStats() {
    try {
      const queueStats =
        this.queue && typeof this.queue.getStats === 'function'
          ? await this.queue.getStats()
          : null;
      return {
        name: this.name,
        handlers: Array.from(this.handlers.keys()),
        handlerCount: this.handlers.size,
        isProcessing: this.isProcessing,
        queue: queueStats,
      };
    } catch (error) {
      return {
        name: this.name,
        error: error.message,
      };
    }
  }

  /**
   * Close the channel
   * @returns {Promise<void>}
   */
  async close() {
    try {
      console.info(`🧹 Closing channel '${this.name}'...`);
      this.handlers.clear();
      this.isProcessing = false;

      if (this.queue && typeof this.queue.close === 'function') {
        await this.queue.close();
      }
      console.info(`✅ Channel '${this.name}' closed`);
    } catch (error) {
      console.error(`❌ Channel '${this.name}': close failed:`, error.message);
    }
  }
}
