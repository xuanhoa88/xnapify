/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

class Hook {
  constructor() {
    this.hooks = new Map(); // Map<hookId, Set<callback>>
    this.registrations = new Map(); // Map<pluginId, Set<{ hookId, callback }>>
  }

  /**
   * Register a hook callback
   * @param {string} hookId - Hook identifier
   * @param {Function} callback - Callback function
   * @param {string} [pluginId] - Optional plugin ID for auto-cleanup
   */
  register(hookId, callback, pluginId) {
    if (!this.hooks.has(hookId)) {
      this.hooks.set(hookId, new Set());
    }

    const callbacks = this.hooks.get(hookId);

    if (callbacks.has(callback)) {
      console.warn(
        `[HookRegistry] Duplicate callback registration for hook "${hookId}"${
          pluginId ? ` by plugin "${pluginId}"` : ''
        }`,
      );
      return this;
    }

    callbacks.add(callback);

    // Track for plugin cleanup
    if (pluginId) {
      if (!this.registrations.has(pluginId)) {
        this.registrations.set(pluginId, new Set());
      }
      this.registrations.get(pluginId).add({ hookId, callback });
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
   * Execute all callbacks for a hook sequentially
   * @param {string} hookId - Hook identifier
   * @param {...any} args - Arguments to pass to callbacks
   * @returns {Promise<Array>} Results from all callbacks
   */
  async execute(hookId, ...args) {
    const callbacks = this.hooks.get(hookId);
    if (!callbacks) return [];

    const results = [];
    for (const callback of callbacks) {
      try {
        results.push(await callback(...args));
      } catch (error) {
        console.error(`[HookRegistry] Hook "${hookId}" error:`, error);
      }
    }
    return results;
  }

  /**
   * Clear hooks
   * If pluginId is provided, clears only hooks for that plugin
   * Otherwise clears all hooks
   * @param {string} [pluginId] - Optional plugin ID
   */
  clear(pluginId) {
    if (pluginId) {
      const registrations = this.registrations.get(pluginId);
      if (!registrations) return;

      for (const { hookId, callback } of registrations) {
        this.unregister(hookId, callback);
      }

      this.registrations.delete(pluginId);
    } else {
      this.hooks.clear();
      this.registrations.clear();
    }
  }
}

export default Hook;
