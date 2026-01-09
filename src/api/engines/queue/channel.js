/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
   */
  on(eventName, handler) {
    if (!eventName || typeof handler !== 'function') {
      return this;
    }

    try {
      this.handlers.set(eventName, handler);

      if (!this.isProcessing) {
        this.startProcessing();
      }
    } catch (error) {
      console.error(`Channel '${this.name}': on() failed:`, error.message);
    }

    return this;
  }

  /**
   * Remove an event handler
   */
  off(eventName) {
    try {
      this.handlers.delete(eventName);
    } catch (_) {
      // Ignore errors
    }
    return this;
  }

  /**
   * Emit an event (adds job to queue)
   */
  emit(eventName, data = {}, options = {}) {
    if (!eventName || !this.queue) return null;

    try {
      return this.queue.add(eventName, data, options);
    } catch (error) {
      console.error(`Channel '${this.name}': emit failed:`, error.message);
      return null;
    }
  }

  /**
   * Emit multiple events
   */
  emitBulk(events = []) {
    if (!Array.isArray(events)) return [];

    return events
      .map(({ event, data, options }) => this.emit(event, data, options))
      .filter(Boolean);
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
          return { skipped: true };
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
   * Get channel stats
   */
  getStats() {
    try {
      return {
        name: this.name,
        handlers: Array.from(this.handlers.keys()),
        queue: this.queue && this.queue.getStats ? this.queue.getStats() : null,
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
   */
  async close() {
    try {
      this.handlers.clear();
      this.isProcessing = false;

      if (this.queue && typeof this.queue.close === 'function') {
        await this.queue.close();
      }
    } catch (error) {
      console.error(`Channel '${this.name}': close failed:`, error.message);
    }
  }
}
