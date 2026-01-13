/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhook Engine - Provides webhook delivery capabilities with support for
 * multiple adapters, automatic retry with exponential backoff, HMAC signatures,
 * and background worker processing for batch operations.
 *
 * ## Architecture
 *
 * ```
 * WebhookManager (factory.js)
 * ├── Adapters
 * │   ├── http     - Actual HTTP delivery with fetch
 * │   ├── memory   - In-memory storage for testing
 * │   └── database - SQLite persistence for tracking/retry
 * └── Workers
 *     ├── send     - HTTP-only background worker
 *     └── persist  - Database-only background worker
 * ```
 *
 * ## Adapters
 *
 * | Adapter | Purpose | Storage |
 * |---------|---------|---------|
 * | `http` | Real HTTP delivery | None |
 * | `memory` | Testing/development | In-memory |
 * | `database` | Production tracking | SQLite |
 *
 * ## Common API (all adapters)
 *
 * - `send(url, payload, options)` - Send/store webhook
 * - `getById(webhookId)` - Get webhook by ID
 * - `getStats()` - Get adapter statistics
 *
 * ---
 *
 * @example <caption>Basic Usage - Send a single webhook</caption>
 * await webhook.send({ event: 'user.created', data: { id: '123' } }, {
 *   url: 'https://api.example.com/hook'
 * });
 *
 * @example <caption>Advanced Usage - HMAC Signature & Retry Config</caption>
 * await webhook.send({ event: 'order.completed' }, {
 *   url: 'https://api.example.com/hook',
 *   secret: 'my-secret-key',
 *   algorithm: 'sha256',
 *   retries: 5,
 *   timeout: 10000
 * });
 *
 * @example <caption>Batch Send (Auto-offloads to worker)</caption>
 * await webhook.send([
 *   { event: 'order.completed' },
 *   { event: 'order.updated' }
 * ], {
 *   url: 'https://api.example.com/hook'
 * });
 *
 * @example <caption>Worker Control</caption>
 * // Force background worker
 * await webhook.send({ event: 'test' }, { useWorker: true });
 *
 * // Force direct processing
 * await webhook.send({ event: 'test' }, { useWorker: false });
 *
 * @example <caption>Database Integration</caption>
 * // Setup connection for persistence
 * webhook.setDbConnection(sequelize);
 *
 * // Database adapter usage
 * const db = webhook.getAdapter('database');
 * await db.getWebhooks({ status: 'delivered' });
 * await db.getStats();
 *
 * @example <caption>Worker Pool Operations</caption>
 * // Process send queue
 * await workerPool.processSend([{ event: 'created' }]);
 *
 * // Process persistence
 * await workerPool.processSendWithDb([{ event: 'created' }]);
 *
 * @example <caption>Custom Adapter Implementation</caption>
 * // 1. Define Adapter
 * class SlackAdapter {
 *   async send(data, options) {
 *     const response = await fetch(options.url, {
 *       method: 'POST',
 *       body: JSON.stringify({ text: data.message })
 *     });
 *     return {
 *       success: response.ok,
 *       message: response.statusText,
 *       timestamp: new Date().toISOString()
 *     };
 *   }
 * }
 *
 * // 2. Register
 * webhook.addAdapter('slack', new SlackAdapter());
 *
 * // 3. Use
 * await webhook.send(
 *   { message: 'System online' },
 *   { adapter: 'slack', url: 'https://hooks.slack.com/...' }
 * );
 *
 * @example <caption>Error Handling</caption>
 * try {
 *   await webhook.send({...}, {...});
 * } catch (error) {
 *   if (error instanceof WebhookValidationError) {
 *     // Handle validation error
 *   }
 *   // Log to monitoring service
 * }
 */

import { createFactory } from './factory';

// Export errors
export * from './errors';

// Export constants
export * from './utils/constants';

// Export signature utilities
export * from './utils/signature';

// Export controllers
export * from './controller';

// Export services
export * from './services';

// Export factory creator
export { createFactory };

/**
 * Default singleton instance of WebhookManager
 * @type {WebhookManager}
 */
const webhook = createFactory();

export default webhook;
