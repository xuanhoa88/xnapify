/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Private symbols for internal state
const HOOK_NAME = Symbol('__rsk.hookName__');
const HOOK_HANDLERS = Symbol('__rsk.hookHandlers__');

/**
 * Hook Channel - Async middleware hooks with priority support
 *
 * Inspired by hookified library patterns.
 */
class HookChannel {
  constructor(name = 'default') {
    this[HOOK_NAME] = name;
    this[HOOK_HANDLERS] = new Map();
  }

  /**
   * Get channel name
   * @returns {string}
   */
  get name() {
    return this[HOOK_NAME];
  }

  /**
   * Get handlers map
   * @returns {Map<string, { handler: Function, priority: number }[]>}
   */
  get handlers() {
    return this[HOOK_HANDLERS];
  }

  /**
   * Get registered event names
   * @returns {string[]}
   */
  get events() {
    return Array.from(this[HOOK_HANDLERS].keys());
  }

  /**
   * Register a handler for an event
   *
   * @param {string} event - Event name
   * @param {Function} handler - Async handler function
   * @param {number} [priority=10] - Lower runs first
   * @returns {HookChannel} For chaining
   */
  on(event, handler, priority = 10) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    if (!this[HOOK_HANDLERS].has(event)) {
      this[HOOK_HANDLERS].set(event, []);
    }

    this[HOOK_HANDLERS].get(event).push({ handler, priority });
    this[HOOK_HANDLERS].get(event).sort((a, b) => a.priority - b.priority);

    return this;
  }

  /**
   * Execute all handlers for an event sequentially
   *
   * @param {string} event - Event name
   * @param {...any} args - Arguments passed to handlers (mutable)
   * @returns {Promise<void>}
   */
  async emit(event, ...args) {
    const list = this[HOOK_HANDLERS].get(event);
    if (!list) return;

    for (const { handler } of list) {
      await handler(...args);
    }
  }

  /**
   * Remove handlers for an event
   * @param {string} [event] - Event name, or all if omitted
   */
  off(event) {
    if (event) {
      this[HOOK_HANDLERS].delete(event);
    } else {
      this[HOOK_HANDLERS].clear();
    }
  }

  /**
   * Create a bound wrapper of this channel with a context object.
   * Handlers registered through the wrapper will be invoked with
   * the provided context as `this` (handler.call(context, ...args)).
   *
   * @param {Object} context
   * @returns {{on: Function, emit: Function, off: Function, name: string, events: string[]}}
   */
  withContext(context) {
    const channel = this;
    const wrapperMap = new WeakMap();

    return {
      on(event, handler, priority = 10) {
        if (typeof handler !== 'function') {
          throw new TypeError('Handler must be a function');
        }

        // Wrap handler so it runs with the provided context as `this`
        const wrapped = (...args) => handler.call(context, ...args);
        wrapperMap.set(handler, wrapped);

        channel.on(event, wrapped, priority);
        return this;
      },

      emit(event, ...args) {
        return channel.emit(event, ...args);
      },

      off(event) {
        return channel.off(event);
      },

      get name() {
        return channel.name;
      },

      get events() {
        return channel.events;
      },
    };
  }
}

export { HookChannel };
