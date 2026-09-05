/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Lifecycle event bus for the extension managers.
 *
 * Deliberately not Node's EventEmitter: subscribers here are async, every
 * subscriber must run even when an earlier one throws, and `emit` has to be
 * awaitable so callers can sequence work after the notifications settle.
 *
 * Failures are logged and contained. A listener watching extension lifecycle
 * events must never be able to abort the lifecycle it is only observing.
 */
class EventBus {
  /**
   * @param {string} [label='ExtensionManager'] - Prefix used in error logs
   */
  constructor(label = 'ExtensionManager') {
    this.label = label;
    this.listeners = new Map(); // Map<eventType, Set<handler>>
  }

  /**
   * Subscribe to an event.
   * @param {string} eventType
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  on(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
    return () => this.off(eventType, handler);
  }

  /**
   * Unsubscribe one handler, or every handler for the event type.
   * @param {string} eventType
   * @param {Function} [handler] - Omit to remove all handlers for the type
   */
  off(eventType, handler) {
    const handlers = this.listeners.get(eventType);
    if (!handlers) return;

    if (!handler) {
      this.listeners.delete(eventType);
      return;
    }

    handlers.delete(handler);
    if (handlers.size === 0) this.listeners.delete(eventType);
  }

  /**
   * Notify every subscriber and wait for them all to settle.
   *
   * The set is copied first so a handler that unsubscribes itself (a common
   * "once" pattern) cannot mutate the collection mid-iteration.
   *
   * @param {string} eventType
   * @param {*} data
   * @returns {Promise<void>} Resolves once every handler settled
   */
  async emit(eventType, data) {
    const handlers = this.listeners.get(eventType);
    if (!handlers || handlers.size === 0) return;

    await Promise.all(
      [...handlers].map(async handler => {
        try {
          await handler(data);
        } catch (error) {
          console.error(
            `[${this.label}] Event handler error for "${eventType}":`,
            error,
          );
        }
      }),
    );
  }

  /**
   * Number of subscribers for an event type.
   * @param {string} eventType
   * @returns {number}
   */
  count(eventType) {
    const handlers = this.listeners.get(eventType);
    return handlers ? handlers.size : 0;
  }

  /** Drop every subscriber. */
  clear() {
    this.listeners.clear();
  }
}

export default EventBus;
