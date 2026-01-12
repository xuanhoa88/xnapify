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
 * await webhook.send({
 *   payload: { url: 'https://api.example.com/hook', event: 'user.created', data: { id: '123' } }
 * });
 *
 * @example <caption>With HMAC Signature</caption>
 * await webhook.send({
 *   payload: { url: 'https://api.example.com/hook', event: 'order.completed' }
 * }, {
 *   secret: 'my-secret-key',
 *   algorithm: 'sha256'
 * });
 *
 * @example <caption>With Retry Options</caption>
 * await webhook.send({ payload: { url, ...data } }, {
 *   retries: 5,
 *   timeout: 10000,
 *   retryDelay: 1000
 * });
 *
 * @example <caption>Batch Send (auto-offloads to worker for 5+ webhooks)</caption>
 * await webhook.send([
 *   { payload: { url: 'https://a.com/hook', event: 'created' } },
 *   { payload: { url: 'https://b.com/hook', event: 'updated' } }
 * ]);
 *
 * @example <caption>Force Worker Processing</caption>
 * // Force background worker
 * await webhook.send({ payload: { url, ...data } }, { useWorker: true });
 *
 * // Force direct processing (bypass worker)
 * await webhook.send(webhooks, { useWorker: false });
 *
 * @example <caption>Database Connection Setup</caption>
 * // Auto-configures both adapter and worker
 * webhook.setDbConnection(engines.db.connection);
 *
 * // For fork mode workers
 * webhook.setConnectionFactory(() => createConnection());
 *
 * @example <caption>Direct Adapter Access</caption>
 * // Get specific adapter
 * const httpAdapter = webhook.getAdapter('http');
 * const memoryAdapter = webhook.getAdapter('memory');
 * const dbAdapter = webhook.getAdapter('database');
 *
 * @example <caption>Database Adapter - Persistence & Tracking</caption>
 * const db = webhook.getAdapter('database');
 *
 * // Store webhook (pending status)
 * const result = await db.send({ url: 'https://api.example.com/hook', event: 'user.created' });
 *
 * // Query webhook history
 * const history = await db.getWebhooks({
 *   status: 'delivered',
 *   limit: 20
 * });
 *
 * // Get delivery statistics
 * const stats = await db.getStats();
 * // => { total: 100, pending: 5, delivered: 90, failed: 5 }
 *
 * // Update status after delivery
 * await db.updateStatus(webhookId, {
 *   success: true,
 *   statusCode: 200,
 *   attempts: 1
 * });
 *
 * // Get pending retries
 * const pending = await db.getPendingRetries({ limit: 50 });
 *
 * // Cleanup old webhooks (30+ days old)
 * const deleted = await db.cleanup({ olderThan: 30 });
 *
 * @example <caption>Memory Adapter - Testing</caption>
 * const memory = webhook.getAdapter('memory');
 *
 * // Send webhook (stored in memory)
 * await memory.send({ url: 'https://api.example.com/hook', event: 'test' });
 *
 * // Get all sent webhooks
 * const sent = memory.getSentWebhooks();
 *
 * // Get last webhook
 * const last = memory.getLastWebhook();
 *
 * // Clear all stored webhooks
 * memory.clear();
 *
 * @example <caption>Worker Pool - Background Processing</caption>
 * // HTTP-only (no database)
 * await workerPool.processSend([{ payload: { url, event: 'created' } }]);
 *
 * // Database-only (no HTTP)
 * await workerPool.processStore([{ payload: { url, event: 'created' } }]);
 *
 * // Combined: Store → Send → Update status
 * await workerPool.processSendWithDb([{ payload: { url, event: 'created' } }]);
 *
 * @example <caption>Create Isolated Instance (for testing)</caption>
 * const testWebhook = createFactory({ adapter: 'memory' });
 * await testWebhook.send({ payload: { url, event: 'created' } });
 * console.log(testWebhook.getAdapter('memory').getLastWebhook());
 */

import { createFactory } from './factory';

// Export worker pool
export { default as workerPool } from './workers';

// Export errors
export * from './errors';

// Export constants
export * from './utils/constants';

// Export signature utilities
export * from './utils/signature';

// Export adapters
export * from './adapters';

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
