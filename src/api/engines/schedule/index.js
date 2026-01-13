/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Schedule Engine - Provides cron-based task scheduling capabilities.
 * Wraps `node-cron` to allow modules to register and manage recurring tasks.
 *
 * ## Architecture
 *
 * ```
 * ScheduleManager (factory.js)
 * └── Tasks (Map)
 *     └── [loadUserStats] -> { task: CronTask, expression: '0 0 * * *' }
 * ```
 *
 * ## Features
 *
 * - **Dynamic Registration**: Register/unregister tasks at runtime.
 * - **Graceful Shutdown**: Stops all tasks when the engine stops.
 * - **Auto-start**: Tasks can start automatically upon registration.
 *
 * ---
 *
 * @example <caption>Basic Usage - Register a daily task</caption>
 * schedule.register('daily-report', '0 0 * * *', async () => {
 *   console.log('Generating daily report...');
 *   await generateReport();
 * });
 *
 * @example <caption>Advanced Usage - With timezone and auto-start control</caption>
 * schedule.register('morning-alert', '0 8 * * *', sendAlert, {
 *   scheduled: true,
 *   timezone: 'America/New_York'
 * });
 *
 * @example <caption>Using with Workers - Offload heavy processing</caption>
 * // In your module where workerPool is defined
 * schedule.register('weekly-maintenance', '0 0 * * 0', async () => {
 *   // Offload to background worker
 *   await workerPool.sendRequest('maintenance', 'RUN_MAINTENANCE', { mode: 'full' });
 * });
 *
 * @example <caption>Managing Tasks</caption>
 * // Stop a specific task
 * schedule.unregister('daily-report');
 *
 * // Stop all tasks
 * schedule.stop();
 *
 * // Start all tasks (if stopped or autoStart was false)
 * schedule.start();
 */

import { createFactory } from './factory';

// Export factory creator
export { createFactory };

// Export Manager class for type referencing and extension if needed
export { default as ScheduleManager } from './manager';

/**
 * Default singleton instance of ScheduleManager
 * @type {import('./manager').default}
 */
const schedule = createFactory();

export default schedule;
