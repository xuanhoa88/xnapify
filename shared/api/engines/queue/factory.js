/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
   * @param {string} name - Channel name
   * @param {Object} options - Channel options
   * @returns {Channel|null} Channel instance or null on error
   */
  function factory(name, options = {}) {
    // Validate channel name
    if (!name || typeof name !== 'string') {
      console.error('queueFactory: Channel name must be a non-empty string');
      return null;
    }

    const channelName = String(name).trim();

    if (!channelName) {
      console.error('queueFactory: Channel name cannot be empty');
      return null;
    }

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
      console.info(`✅ Created queue channel: ${channelName}`);
      return channel;
    } catch (error) {
      console.error(
        `❌ queueFactory: Failed to create '${channelName}':`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Register a custom queue adapter (won't override existing)
   * @param {string} type - Adapter type name
   * @param {Function} AdapterClass - Adapter class constructor
   * @returns {boolean} True if registered, false if already exists
   */
  factory.registerAdapter = function (type, AdapterClass) {
    if (type && typeof AdapterClass === 'function' && !adaptersMap.has(type)) {
      adaptersMap.set(type, AdapterClass);
      console.info(`✅ Registered queue adapter: ${type}`);
      return true;
    }
    return false;
  };

  /**
   * Get an existing channel (for producers)
   * @param {string} name - Channel name
   * @returns {Channel|null} Channel instance or null if not found
   */
  factory.channel = function (name) {
    if (!name) return null;
    return channelsMap.get(String(name).trim()) || null;
  };

  /**
   * Check if channel exists
   * @param {string} name - Channel name
   * @returns {boolean} True if channel exists
   */
  factory.has = function (name) {
    return name ? channelsMap.has(String(name).trim()) : false;
  };

  /**
   * Get all channel names
   * @returns {Array<string>} Array of channel names
   */
  factory.getChannelNames = function () {
    return Array.from(channelsMap.keys());
  };

  /**
   * Get stats for all channels
   * @returns {Object} Stats object keyed by channel name
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
   * @param {string} name - Channel name
   * @returns {Promise<boolean>} True if removed
   */
  factory.remove = async function (name) {
    if (!name) return false;

    const channel = channelsMap.get(String(name).trim());
    if (channel) {
      try {
        await channel.close();
        console.info(`✅ Removed queue channel: ${name}`);
      } catch (error) {
        console.warn(`Queue channel '${name}' close error:`, error.message);
      }
      return channelsMap.delete(String(name).trim());
    }
    return false;
  };

  /**
   * Close all channels
   * Called automatically on process termination
   * @returns {Promise<void>}
   */
  factory.cleanup = async function () {
    console.info('🧹 Closing all queue channels...');
    for (const [name, channel] of channelsMap) {
      try {
        await channel.close();
        console.info(`✅ Closed queue channel: ${name}`);
      } catch (error) {
        console.warn(`Queue channel '${name}' close error:`, error.message);
      }
    }
    channelsMap.clear();
    console.info('✅ Queue engine cleanup complete');
  };

  return factory;
}

/**
 * Create a new isolated factory instance
 * @param {Object} options - Default options for this factory
 * @param {string} [options.type='memory'] - Default adapter type
 * @param {number} [options.concurrency=1] - Default concurrency
 * @returns {Function} New factory function with its own state
 */
export function createFactory(options = {}) {
  const factory = buildFactory(new Map(), new Map([['memory', MemoryQueue]]), {
    ...DEFAULT_OPTIONS,
    ...options,
  });

  // Register cleanup with global coordinator
  process.once('SIGTERM', () => factory.cleanup());
  process.once('SIGINT', () => factory.cleanup());

  return factory;
}
