/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Hook Engine - Channel-based async middleware hooks
 *
 * ## Features
 *
 * - **Channel-based Architecture**: Isolated hook namespaces
 * - **Priority Support**: Control execution order
 * - **Async/Await**: Sequential handler execution
 * - **Mutable Arguments**: Handlers can modify passed data
 *
 * ---
 *
 * @example <caption>Basic Usage</caption>
 *
 * // Get/create a channel
 * const userHooks = hook('users');
 *
 * // Register handlers
 * userHooks.on('create', async (user) => {
 *   user.createdAt = new Date();
 * });
 *
 * // Trigger handlers
 * const user = { name: 'John' };
 * await userHooks.emit('create', user);
 *
 * @example <caption>Priority Control</caption>
 * userHooks.on('save', validateUser, 1);   // Runs first
 * userHooks.on('save', normalizeData, 10); // Runs second
 * userHooks.on('save', logActivity, 100);  // Runs last
 *
 * @example <caption>Factory Management</caption>
 * hook.has('users');          // Check existence
 * hook.getChannelNames();     // List all channels
 * hook.remove('users');       // Remove channel
 * hook.cleanup();             // Clear all channels
 *
 * @example <caption>Isolated Instances</caption>
 * // Create a completely new hooked instance independent of the global singleton
 * const customHook = hook.createFactory();
 * const customChannel = customHook('custom');
 */

import { createFactory } from './factory';

// Export factory creator for isolated instances
export { createFactory };

// Export channel class for direct use
export { HookChannel } from './channel';

/**
 * Singleton factory instance
 */
const hook = createFactory();

export default hook;
