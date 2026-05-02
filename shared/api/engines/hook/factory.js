/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { register } from '../../shutdown';

import { HookChannel } from './channel';
import { InvalidChannelNameError } from './errors';

// Private symbols for internal state
const HOOK_CHANNELS = Symbol('__xnapify.hook.channels__');

/**
 * Hook Factory - Creates and manages named hook channels
 */
class HookFactory {
  constructor() {
    this[HOOK_CHANNELS] = new Map();
  }

  /**
   * Get or create a hook channel
   *
   * @param {string} name - Channel name
   * @returns {HookChannel}
   */
  channel(name) {
    const key = name && typeof name === 'string' ? name.trim() : '';

    if (!key) {
      throw new InvalidChannelNameError();
    }

    if (!this[HOOK_CHANNELS].has(key)) {
      this[HOOK_CHANNELS].set(key, new HookChannel(key));
    }

    return this[HOOK_CHANNELS].get(key);
  }

  /**
   * Check if channel exists
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    const key = name && typeof name === 'string' ? name.trim() : '';
    if (!key) return false;
    return this[HOOK_CHANNELS].has(key);
  }

  /**
   * Remove a channel
   * @param {string} name
   * @returns {boolean}
   */
  remove(name) {
    const key = name && typeof name === 'string' ? name.trim() : '';
    if (!key) return false;

    const channel = this[HOOK_CHANNELS].get(key);
    if (channel) {
      channel.off();
      return this[HOOK_CHANNELS].delete(key);
    }
    return false;
  }

  /**
   * Get all channel names
   * @returns {string[]}
   */
  getChannelNames() {
    return Array.from(this[HOOK_CHANNELS].keys());
  }

  /**
   * Cleanup all channels
   */
  cleanup() {
    for (const channel of this[HOOK_CHANNELS].values()) {
      channel.off();
    }
    this[HOOK_CHANNELS].clear();
  }
}

/**
 * Create a new factory instance
 * @returns {Function} Factory function with channel() method
 */
export function createFactory() {
  const manager = new HookFactory();

  // Make the factory callable: hook('name') === hook.channel('name')
  const factory = name => manager.channel(name);

  // Attach methods
  factory.channel = name => manager.channel(name);
  factory.has = name => manager.has(name);
  factory.remove = name => manager.remove(name);
  factory.getChannelNames = () => manager.getChannelNames();
  factory.cleanup = () => manager.cleanup();

  /**
   * Return a factory bound to the given context (e.g. req.app).
   * Usage:
   *   const reqHook = hook.withContext(req.app);
   *   const profile = reqHook('profile'); // handlers run with req.app as `this`
   *
   * The returned factory is callable and has all the same methods as the original.
   */
  factory.withContext = context => {
    // Create a new callable factory bound to the context
    const boundFactory = name => manager.channel(name).withContext(context);

    // Attach all factory methods to maintain API parity
    boundFactory.channel = name => manager.channel(name).withContext(context);
    boundFactory.has = name => manager.has(name);
    boundFactory.remove = name => manager.remove(name);
    boundFactory.getChannelNames = () => manager.getChannelNames();
    boundFactory.cleanup = () => manager.cleanup();

    // Allow chaining: boundFactory.withContext(newContext)
    // Creates a new bound factory with the new context
    boundFactory.withContext = newContext => factory.withContext(newContext);

    return boundFactory;
  };

  // Register with centralized shutdown coordinator
  register('hook', () => manager.cleanup(), 10);

  return factory;
}
