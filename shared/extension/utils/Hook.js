/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

class Hook {
  constructor() {
    this.hooks = new Map(); // Map<hookId, Set<callback>>
    this.registrations = new Map(); // Map<extensionId, Set<{ hookId, callback }>>
  }

  /**
   * Register a hook callback
   * @param {string} hookId - Hook identifier
   * @param {Function} callback - Callback function
   * @param {string} [extensionId] - Optional extension ID for auto-cleanup
   */
  register(hookId, callback, extensionId) {
    if (!this.hooks.has(hookId)) {
      this.hooks.set(hookId, new Set());
    }

    const callbacks = this.hooks.get(hookId);

    if (callbacks.has(callback)) {
      console.warn(
        `[HookRegistry] Duplicate callback registration for hook "${hookId}"${
          extensionId ? ` by plugin "${extensionId}"` : ''
        }`,
      );
      return this;
    }

    callbacks.add(callback);

    // Track for plugin cleanup
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
    const callbacks = this.hooks.get(hookId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.hooks.delete(hookId);
      }
    }
    return this;
  }

  /**
   * Check if a hook has any registered callbacks
   * @param {string} hookId - Hook identifier
   * @returns {boolean}
   */
  has(hookId) {
    const callbacks = this.hooks.get(hookId);
    return !!callbacks && callbacks.size > 0;
  }

  /**
   * Execute all callbacks for a hook sequentially.
   *
   * Callbacks are executed **in order of registration**, waiting for each to complete
   * before starting the next. Any errors are logged and do not stop subsequent callbacks.
   *
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from successful callbacks (in order)
   */
  async execute(hookId, ...args) {
    const callbacks = this.hooks.get(hookId);
    if (!callbacks) return [];

    const results = [];
    for (const cb of callbacks) {
      try {
        const result = await cb(...args);
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
   * Execute all callbacks for a hook in parallel.
   *
   * Callbacks are **initiated concurrently**. Registration order is preserved in the
   * results array. Any errors are logged and do not stop other callbacks.
   * Use this for high-performance hooks where order and shared state mutation don't matter.
   *
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from successful callbacks (in order)
   */
  async executeParallel(hookId, ...args) {
    const callbacks = this.hooks.get(hookId);
    if (!callbacks) return [];

    const promises = [...callbacks].map(cb =>
      Promise.resolve(cb(...args)).catch(error => {
        console.error(`[HookRegistry] Hook "${hookId}" parallel error:`, error);
        return undefined;
      }),
    );

    const results = await Promise.all(promises);
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
