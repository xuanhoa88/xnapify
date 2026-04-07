/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { HookAbortError, createAggregateError } from './errors';

// Private symbols for internal state
const HOOK_NAME = Symbol('__xnapify.hook.name__');
const HOOK_HANDLERS = Symbol('__xnapify.hook.handlers__');
const ORIGINAL_HANDLER = Symbol('__xnapify.hook.original__');

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

    const list = this[HOOK_HANDLERS].get(event);
    const item = { handler, priority };

    // O(N) Insertion based on priority
    const insertIndex = list.findIndex(h => h.priority > priority);
    if (insertIndex === -1) {
      list.push(item);
    } else {
      list.splice(insertIndex, 0, item);
    }

    return this;
  }

  /**
   * Execute all handlers for an event sequentially (Multicast)
   *
   * @param {string} event - Event name
   * @param {...any} args - Arguments passed to handlers (mutable)
   * @returns {Promise<void>}
   */
  async emit(event, ...args) {
    const handlersList = this[HOOK_HANDLERS].get(event);
    if (!handlersList) return;

    // Clone the array to prevent iteration errors if handlers remove themselves
    const list = [...handlersList];
    const errors = [];

    // Detect abort signal
    const signal = args.find(
      arg => arg && typeof arg === 'object' && arg.aborted !== undefined,
    );

    for (const { handler } of list) {
      if (signal && signal.aborted) {
        errors.push(new HookAbortError());
        break;
      }

      try {
        await handler(...args);
      } catch (err) {
        errors.push(err);
      }
    }

    if (errors.length === 1) {
      throw errors[0];
    }

    if (errors.length > 1) {
      throw createAggregateError(
        errors,
        `Multiple errors occurred in hook channel '${this.name}' event '${event}'`,
      );
    }
  }

  /**
   * Execute handlers sequentially and fail fast if an error occurs (Pipeline)
   *
   * @param {string} event - Event name
   * @param {...any} args - Arguments passed to handlers (mutable)
   * @returns {Promise<void>}
   */
  async invoke(event, ...args) {
    const handlersList = this[HOOK_HANDLERS].get(event);
    if (!handlersList) return;

    const list = [...handlersList];

    // Detect abort signal
    const signal = args.find(
      arg => arg && typeof arg === 'object' && arg.aborted !== undefined,
    );

    for (const { handler } of list) {
      if (signal && signal.aborted) {
        throw new HookAbortError();
      }

      // No wrapper - fails fast on first rejection
      await handler(...args);
    }
  }

  /**
   * Remove handlers for an event
   * @param {string} [event] - Event name, or all if omitted
   * @param {Function} [handler] - Specific handler to remove, or all for event if omitted
   */
  off(event, handler) {
    if (!event) {
      this[HOOK_HANDLERS].clear();
      return;
    }

    if (!handler) {
      this[HOOK_HANDLERS].delete(event);
      return;
    }

    // Remove specific handler
    const list = this[HOOK_HANDLERS].get(event);
    if (list) {
      // Filter out all instances of the handler, in case it was added multiple times
      // Also check against ORIGINAL_HANDLER to smoothly detach bounded proxy wrappers
      const filtered = list.filter(
        h => h.handler !== handler && h.handler[ORIGINAL_HANDLER] !== handler,
      );

      if (filtered.length === 0) {
        this[HOOK_HANDLERS].delete(event);
      } else if (filtered.length !== list.length) {
        // Re-assign the filtered array
        this[HOOK_HANDLERS].set(event, filtered);
      }
    }
  }

  /**
   * Create a bound wrapper of this channel with a context object.
   * Handlers registered through the wrapper will be invoked with
   * the provided context as `this` (handler.call(context, ...args)).
   *
   * @param {Object} context
   * @returns {{on: Function, emit: Function, invoke: Function, off: Function, name: string, events: string[]}}
   */
  withContext(context) {
    const channel = this;

    return {
      on(event, handler, priority = 10) {
        if (typeof handler !== 'function') {
          throw new TypeError('Handler must be a function');
        }

        // Wrap handler so it runs with the provided context as `this`
        const wrapped = (...args) => handler.call(context, ...args);

        // Track the original handler reference recursively to allow O(1) removal.
        // This solves the WeakMap bounded tracking memory leak gracefully.
        wrapped[ORIGINAL_HANDLER] = handler;

        channel.on(event, wrapped, priority);
        return this;
      },

      emit(event, ...args) {
        return channel.emit(event, ...args);
      },

      invoke(event, ...args) {
        return channel.invoke(event, ...args);
      },

      off(event, handler) {
        if (!handler) {
          return channel.off(event);
        }

        return channel.off(event, handler);
      },

      withContext(newContext) {
        return channel.withContext(newContext);
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
