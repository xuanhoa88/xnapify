/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Queue Engine - Channel-based pub/sub for background jobs
 *
 * ## Features
 *
 * - **Channel-based Architecture**: Isolated queues for different purposes
 * - **Pub/Sub Pattern**: Event-based job processing
 * - **Priority & Delays**: Schedule jobs with priority and delayed execution
 * - **Retry Logic**: Automatic retry with exponential backoff
 * - **Concurrency Control**: Limit parallel job processing per channel
 * - **Graceful Shutdown**: Automatically closes all channels on process termination
 *
 * ---
 *
 * @example <caption>Basic Usage - Create channel and process jobs</caption>
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
 * @example <caption>Create isolated instance (for testing)</caption>
 * const testQueue = queue.createFactory({ type: 'memory' });
 * const channel = testQueue('test-channel');
 * channel.on('event', async (job) => { ... });
 *
 * @example <caption>Register custom adapter (cannot override existing)</caption>
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
 *
 * @example <caption>Lifecycle Management</caption>
 * // Get all channels
 * const channels = queue.default.getChannelNames();
 * // ['zalo', 'notifications']
 *
 * // Check if channel exists
 * if (queue.default.has('zalo')) {
 *   console.log('Zalo channel exists');
 * }
 *
 * // Get stats for all channels
 * const stats = queue.default.getStats();
 * // {
 * //   zalo: { name: 'zalo', handlers: ['chat'], handlerCount: 1, ... },
 * //   notifications: { name: 'notifications', handlers: ['send'], ... }
 * // }
 *
 * // Remove a channel
 * await queue.default.remove('zalo');
 *
 * // Close all channels (automatically called on process termination)
 * await queue.default.cleanup();
 *
 * @example <caption>Integration with Schedule Engine</caption>
 * import schedule from 'src/api/engines/schedule';
 * import queue from 'src/api/engines/queue';
 *
 * // Create a notification channel
 * const notifications = queue.default('notifications', { concurrency: 10 });
 * notifications.on('email', async (job) => {
 *   await sendEmail(job.data);
 * });
 *
 * // Schedule daily digest emails
 * schedule.register('daily-digest', '0 9 * * *', () => {
 *   // Emit job to queue for processing
 *   queue.default.channel('notifications').emit('email', {
 *     to: 'users@example.com',
 *     subject: 'Daily Digest',
 *     template: 'digest'
 *   });
 * });
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
