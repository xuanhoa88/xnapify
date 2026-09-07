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
/** The complete vocabulary; anything else is a typo, not an extension point. */
const QUEUE_EVENTS = Object.freeze([
  'completed',
  'failed',
  'progress',
  'active',
  'stalled',
]);

/**
 * Say so when a caller names an event that does not exist.
 *
 * Registration stays non-fatal — `on()` has always tolerated an unknown name
 * and callers rely on that — but tolerating it silently made the typo total:
 * `on()` returned normally, the handler was never stored, and the event fired
 * for the life of the process with nothing listening. Nothing distinguished
 * that from an event that simply never occurred. `off()` fails the same way
 * from the other side: it removes nothing and the handler keeps firing.
 *
 * @param {string} method - 'on' or 'off', so the log names the call site.
 * @param {string} event - The unrecognized name.
 */
function warnUnknownEvent(method, event) {
  console.warn(
    `Queue ${method}(): unknown event "${event}"; nothing was registered. ` +
      `Known events: ${QUEUE_EVENTS.join(', ')}.`,
  );
}

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
    if (!this.eventHandlers[event]) {
      warnUnknownEvent('on', event);
      return;
    }
    this.eventHandlers[event].push(handler);
  };

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler to remove
   */
  target.off = function off(event, handler) {
    if (!this.eventHandlers[event]) {
      warnUnknownEvent('off', event);
      return;
    }
    const index = this.eventHandlers[event].indexOf(handler);
    if (index > -1) {
      this.eventHandlers[event].splice(index, 1);
    }
  };

  /**
   * Emit event — calls all registered handlers, catching errors.
   *
   * Handlers may be async, and an async function does not throw: it returns a
   * rejected promise, which the try/catch around the call cannot see. Left
   * alone that rejection has no handler attached anywhere, and Node treats an
   * unhandled rejection as an uncaughtException — so one failing listener on
   * `failed` (itself only ever reached because something already went wrong)
   * took the whole worker process down with it.
   *
   * Emission stays synchronous and does not wait for async handlers; this only
   * makes sure their failures are reported instead of fatal.
   *
   * @param {string} event - Event name
   * @param {...*} args - Event arguments
   */
  target.emit = function emit(event, ...args) {
    if (!this.eventHandlers[event]) return;

    for (const handler of this.eventHandlers[event]) {
      const report = error => {
        console.error(`Error in queue ${event} event handler:`, error);
      };

      try {
        const result = handler(...args);
        if (result && typeof result.then === 'function') result.catch(report);
      } catch (error) {
        report(error);
      }
    }
  };
}
