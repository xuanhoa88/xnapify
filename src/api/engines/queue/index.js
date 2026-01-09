/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Queue Engine - Channel-based pub/sub for background jobs
 *
 * @example
 * // Access singleton instance
 * const manager = queue.default;
 *
 * // Create/get a channel (consumer)
 * const zalo = queue.default('zalo', { concurrency: 5 });
 * zalo.on('chat', async (job) => { console.log(job.data); });
 *
 * // Emit event (producer)
 * queue.default.channel('zalo').emit('chat', { message: 'Hello' });
 *
 * @example
 * // Create isolated instance (for testing)
 * const testQueue = queue.createFactory({ type: 'memory' });
 * const channel = testQueue('test-channel');
 * channel.on('event', async (job) => { ... });
 *
 * @example
 * // Register custom adapter (cannot override existing)
 * class RedisQueue {
 *   constructor(options) { ... }
 *   add(event, data, opts) { ... }
 *   process(event, handler) { ... }
 *   close() { ... }
 * }
 *
 * queue.default.registerAdapter('redis', RedisQueue);
 * const channel = queue.default('notifications', { type: 'redis' });
 * channel.on('send', async (job) => { ... });
 */

import { createFactory } from './factory';

// Constants
export { JOB_STATUS } from './utils/constants';

// Export factory for creating instances
export { createFactory };

/**
 * Singleton instance of QueueFactory
 * Used by the application via queue.default
 */
const queue = createFactory();

export default queue;
