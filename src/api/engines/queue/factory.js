/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import MemoryQueue from './adapters/memory';
import { Channel } from './channel';

// Default options
const DEFAULT_OPTIONS = Object.freeze({
  type: 'memory',
  concurrency: 1,
});

/**
 * Build a factory function with shared logic
 * @private
 */
function buildFactory(channelsMap, adaptersMap, baseOptions) {
  /**
   * Create or get a channel
   */
  function factory(name, options = {}) {
    if (!name) return null;

    const channelName = String(name).trim();

    // Return existing
    if (channelsMap.has(channelName)) {
      return channelsMap.get(channelName);
    }

    // Create queue
    const queueOptions = { ...baseOptions, ...options, name: channelName };
    const AdapterClass = adaptersMap.get(queueOptions.type);

    if (!AdapterClass) {
      console.error(`queueFactory: Unknown adapter '${queueOptions.type}'`);
      return null;
    }

    try {
      const queue = new AdapterClass(queueOptions);
      const channel = new Channel(channelName, queue);
      channelsMap.set(channelName, channel);
      return channel;
    } catch (error) {
      console.error(
        `queueFactory: Failed to create '${channelName}':`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Register a custom queue adapter (won't override existing)
   */
  factory.registerAdapter = function (type, AdapterClass) {
    if (type && typeof AdapterClass === 'function' && !adaptersMap.has(type)) {
      adaptersMap.set(type, AdapterClass);
      return true;
    }
    return false;
  };

  /**
   * Get an existing channel (for producers)
   */
  factory.channel = function (name) {
    if (!name) return null;
    return channelsMap.get(String(name).trim()) || null;
  };

  /**
   * Check if channel exists
   */
  factory.has = function (name) {
    return name ? channelsMap.has(String(name).trim()) : false;
  };

  /**
   * Get all channel names
   */
  factory.getChannelNames = function () {
    return Array.from(channelsMap.keys());
  };

  /**
   * Get stats for all channels
   */
  factory.getStats = function () {
    const stats = {};
    for (const [name, channel] of channelsMap) {
      try {
        stats[name] = channel.getStats();
      } catch (error) {
        stats[name] = { error: error.message };
      }
    }
    return stats;
  };

  /**
   * Remove a channel
   */
  factory.remove = async function (name) {
    if (!name) return false;

    const channel = channelsMap.get(String(name).trim());
    if (channel) {
      try {
        await channel.close();
      } catch (_) {
        // Ignore close errors
      }
      return channelsMap.delete(String(name).trim());
    }
    return false;
  };

  /**
   * Close all channels
   */
  factory.closeAll = async function () {
    for (const channel of channelsMap.values()) {
      try {
        await channel.close();
      } catch (_) {
        // Ignore close errors
      }
    }
    channelsMap.clear();
  };

  return factory;
}

// Singleton state
const channels = new Map();
const adapters = new Map([['memory', MemoryQueue]]);

/**
 * Queue Factory
 *
 * Creates or retrieves channel instances for pub/sub messaging.
 *
 * @param {string} name - Channel name
 * @param {Object} options - Channel options
 * @param {string} [options.type='memory'] - Queue adapter type
 * @param {number} [options.concurrency=1] - Concurrent workers
 * @returns {Channel|null} Channel instance
 */
const queueFactory = buildFactory(channels, adapters, DEFAULT_OPTIONS);

/**
 * Create a new isolated factory instance
 * @param {Object} options - Default options for this factory
 * @returns {Function} New factory function with its own state
 */
export function createFactory(options = {}) {
  return buildFactory(new Map(), new Map([['memory', MemoryQueue]]), {
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

// Export default singleton factory
export default queueFactory;
