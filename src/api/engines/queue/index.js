/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Queue Engine - Channel-based pub/sub for background jobs
 *
 * @example <caption>Basic Usage</caption>
 * // Setup
 * app.set('queue', queueFactory);
 *
 * // Consumer - Register handlers
 * const queue = app.get('queue');
 * const zalo = queue('zalo', { concurrency: 5 });
 * zalo.on('chat', async (job) => { console.log(job.data); });
 *
 * // Producer - Emit events
 * queue.channel('zalo').emit('chat', { message: 'Hello' });
 *
 * @example <caption>Custom Adapter</caption>
 * // Register adapter and use
 * queue.registerAdapter('redis', RedisQueue);
 * const channel = queue('notifications', { type: 'redis' });
 * channel.on('send', async (job) => { ... });
 */

// Constants
export { JOB_STATUS } from './utils/constants';

// Factory
export { default as queueFactory, createFactory } from './factory';

// Default export is the singleton factory
export { default } from './factory';
