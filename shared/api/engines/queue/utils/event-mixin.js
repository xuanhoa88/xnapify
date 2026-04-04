/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Event system mixin for queue adapters.
 * Provides on(), off(), emit() with error-safe handler invocation.
 *
 * @param {Object} target - Adapter instance to augment
 */
export function applyEventMixin(target) {
  target.eventHandlers = {
    completed: [],
    failed: [],
    progress: [],
    active: [],
    stalled: [],
  };

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  target.on = function on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  };

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler to remove
   */
  target.off = function off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  };

  /**
   * Emit event — calls all registered handlers, catching errors
   * @param {string} event - Event name
   * @param {...*} args - Event arguments
   */
  target.emit = function emit(event, ...args) {
    if (this.eventHandlers[event]) {
      for (const handler of this.eventHandlers[event]) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in queue ${event} event handler:`, error);
        }
      }
    }
  };
}
