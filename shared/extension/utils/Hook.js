/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Hook registry — collector extension points (many contributors).
 *
 * Every registered callback runs and the caller merges the results. A failing
 * callback is logged and dropped so one broken extension cannot break a merged
 * UI such as table columns or settings tabs.
 *
 * For request/response extension points where the caller needs the answer and
 * needs to know when it failed, use `Handler` instead.
 */
class Hook {
  constructor() {
    this.hooks = new Map(); // Map<hookId, Array<{ callback, priority }>>
    this.registrations = new Map(); // Map<extensionId, Set<{ hookId, callback }>>
  }

  /**
   * Register a hook callback with optional priority.
   * Lower priority values execute first (default: 0).
   *
   * @param {string} hookId - Hook identifier
   * @param {Function} callback - Callback function
   * @param {string} [extensionId] - Optional extension ID for auto-cleanup
   * @param {Object} [options] - Options
   * @param {number} [options.priority=0] - Execution priority (lower = earlier)
   */
  register(hookId, callback, extensionId, { priority = 0 } = {}) {
    if (!this.hooks.has(hookId)) {
      this.hooks.set(hookId, []);
    }

    const entries = this.hooks.get(hookId);

    // Check for duplicate
    if (entries.some(e => e.callback === callback)) {
      console.warn(
        `[HookRegistry] Duplicate callback registration for hook "${hookId}"${
          extensionId ? ` by extension "${extensionId}"` : ''
        }`,
      );
      return this;
    }

    // Insert in priority order (stable: append at end of same-priority group)
    const entry = { callback, priority, extensionId };
    const insertIdx = entries.findIndex(e => e.priority > priority);
    if (insertIdx === -1) {
      entries.push(entry);
    } else {
      entries.splice(insertIdx, 0, entry);
    }

    // Track for extension cleanup
    if (extensionId) {
      if (!this.registrations.has(extensionId)) {
        this.registrations.set(extensionId, new Set());
      }
      this.registrations.get(extensionId).add({ hookId, callback });
    }

    return this;
  }

  /**
   * Unregister a hook callback
   * @param {string} hookId - Hook identifier
   * @param {Function} callback - Callback function
   */
  unregister(hookId, callback) {
    const entries = this.hooks.get(hookId);
    if (entries) {
      const idx = entries.findIndex(e => e.callback === callback);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
      if (entries.length === 0) {
        this.hooks.delete(hookId);
      }
    }
    // Drop the ownership record so owns() stays accurate
    for (const [extensionId, registrations] of this.registrations) {
      for (const entry of registrations) {
        if (entry.hookId === hookId && entry.callback === callback) {
          registrations.delete(entry);
        }
      }
      if (registrations.size === 0) this.registrations.delete(extensionId);
    }
    return this;
  }

  /**
   * Whether `extensionId` registered this exact callback for `hookId`.
   * Used by scoped registries to stop one extension from unregistering
   * another extension's handlers.
   *
   * @param {string} extensionId
   * @param {string} hookId
   * @param {Function} callback
   * @returns {boolean}
   */
  owns(extensionId, hookId, callback) {
    const registrations = this.registrations.get(extensionId);
    if (!registrations) return false;
    for (const entry of registrations) {
      if (entry.hookId === hookId && entry.callback === callback) return true;
    }
    return false;
  }

  /**
   * Check if a hook has any registered callbacks
   * @param {string} hookId - Hook identifier
   * @returns {boolean}
   */
  has(hookId) {
    const entries = this.hooks.get(hookId);
    return !!entries && entries.length > 0;
  }

  /**
   * Execute all callbacks for a hook sequentially (in priority order).
   *
   * Callbacks are executed **in priority order** (lower first), waiting for
   * each to complete before starting the next. Any errors are logged and
   * do not stop subsequent callbacks.
   *
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from successful callbacks (in order)
   */
  async execute(hookId, ...args) {
    const entries = this.hooks.get(hookId);
    if (!entries) return [];

    const results = [];
    for (const { callback } of entries) {
      try {
        const result = await callback(...args);
        if (result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[HookRegistry] Hook "${hookId}" error:`, error);
      }
    }

    return results;
  }

  /**
   * Execute all callbacks for a hook in parallel (priority order preserved in results).
   *
   * Callbacks are **initiated concurrently**. Priority order is preserved in the
   * results array. Any errors are logged and do not stop other callbacks.
   * Use this for high-performance hooks where order and shared state mutation don't matter.
   *
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from successful callbacks (in order)
   */
  async executeParallel(hookId, ...args) {
    const entries = this.hooks.get(hookId);
    if (!entries) return [];

    // `callback` is invoked inside an async function so a synchronous throw
    // rejects like an async one. Wrapping with Promise.resolve() would let a
    // sync throw escape the catch and reject the whole batch.
    const settle = async ({ callback }) => {
      try {
        return await callback(...args);
      } catch (error) {
        console.error(`[HookRegistry] Hook "${hookId}" parallel error:`, error);
        return undefined;
      }
    };

    const results = await Promise.all(entries.map(settle));
    return results.filter(r => r !== undefined);
  }

  /**
   * Clear hooks
   * If extensionId is provided, clears only hooks for that extension
   * Otherwise clears all hooks
   * @param {string} [extensionId] - Optional extension ID
   */
  clear(extensionId) {
    if (extensionId) {
      const registrations = this.registrations.get(extensionId);
      if (!registrations) return;

      for (const { hookId, callback } of registrations) {
        this.unregister(hookId, callback);
      }

      this.registrations.delete(extensionId);
    } else {
      this.hooks.clear();
      this.registrations.clear();
    }
  }
}

export default Hook;
