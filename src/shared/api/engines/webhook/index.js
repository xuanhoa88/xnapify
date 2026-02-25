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
 * ## Features
 *
 * - **Multiple Adapters**: HTTP, Memory, Database for different use cases
 * - **Retry Logic**: Exponential backoff with configurable attempts
 * - **HMAC Signatures**: Secure webhook signing with various algorithms
 * - **Worker Support**: Background processing for large payloads
 * - **Graceful Shutdown**: Automatic cleanup on process termination
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
 * @example <caption>Lifecycle Management</caption>
 * // Get all registered adapters
 * const adapters = webhook.getAdapterNames();
 * // ['database', 'memory', 'http']
 *
 * // Check if adapter exists
 * if (webhook.hasAdapter('http')) {
 *   console.log('HTTP adapter available');
 * }
 *
 * // Get stats from all adapters
 * const stats = webhook.getAllStats();
 * // {
 * //   database: { total: 100, delivered: 95, failed: 5 },
 * //   memory: { total: 10, delivered: 10, failed: 0 },
 * //   http: { available: false }
 * // }
 *
 * // Cleanup (automatically called on process termination)
 * await webhook.cleanup();
 *
 * @example <caption>Integration with Schedule Engine</caption>
 *
 * // Send daily summary webhooks
 * schedule.register('daily-webhooks', '0 9 * * *', async () => {
 *   const summary = await generateDailySummary();
 *
 *   await webhook.send(summary, {
 *     url: 'https://api.example.com/daily-summary',
 *     secret: process.env.WEBHOOK_SECRET,
 *     retries: 3
 *   });
 * });
 *
 * @example <caption>Integration with Queue Engine</caption>
 *
 * // Create a webhook delivery channel
 * const webhooks = queue('webhooks', { concurrency: 5 });
 *
 * webhooks.on('deliver', async (job) => {
 *   await webhook.send(job.data.payload, job.data.options);
 * });
 *
 * // Queue webhook for delivery
 * queue.channel('webhooks').emit('deliver', {
 *   payload: { event: 'user.updated' },
 *   options: { url: 'https://api.example.com/hook' }
 * });
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
export * as services from './services';

// Export factory creator
export { createFactory };

/**
 * Default singleton instance of WebhookManager
 * @type {WebhookManager}
 */
const webhook = createFactory();

export default webhook;
