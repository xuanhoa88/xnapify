/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhook Engine — Inbound webhook handler registration
 *
 * Exposes endpoints for 3rd-party services (Stripe, GitHub, Facebook, etc.)
 * to send events to your application. Modules register handlers via the
 * hook-based API, and the controller automatically verifies HMAC signatures
 * before dispatching.
 *
 * ## Architecture
 *
 * ```
 * WebhookManager (factory.js)
 * ├── HookChannel        — Priority-based handler dispatch
 * ├── Provider Registry  — Secret + signature header per provider
 * └── Controller         — POST /:provider with auto-verify
 * ```
 *
 * ## Features
 *
 * - **Hook-based Registration**: Modules register handlers via `webhook.handler()`
 * - **Auto Signature Verification**: HMAC verification in the controller
 * - **Lifecycle Hooks**: `beforeHandle` / `afterHandle` for cross-cutting concerns
 * - **Priority Support**: Control handler execution order
 *
 * ---
 *
 * @example <caption>Register a Provider Handler</caption>
 * webhook.handler('stripe', {
 *   secret: process.env.STRIPE_WEBHOOK_SECRET,
 *   signatureHeader: 'stripe-signature',
 *   handler: async (payload, context) => {
 *     await processStripeEvent(payload);
 *   },
 * });
 *
 * @example <caption>Register a GitHub Handler</caption>
 * webhook.handler('github', {
 *   secret: process.env.GITHUB_WEBHOOK_SECRET,
 *   signatureHeader: 'x-hub-signature-256',
 *   handler: async (payload, context) => {
 *     if (payload.action === 'push') {
 *       await triggerBuild(payload.repository);
 *     }
 *   },
 * });
 *
 * @example <caption>Lifecycle Hooks</caption>
 * webhook.on('afterHandle', async ({ provider, payload }) => {
 *   console.log(`Webhook from ${provider} processed`);
 * });
 *
 * @example <caption>Revoke a Provider</caption>
 * webhook.removeHandler('github');
 *
 * @example <caption>List Providers</caption>
 * webhook.getProviders(); // ['stripe', 'github']
 *
 * @example <caption>Isolated Instance</caption>
 * const myWebhook = createFactory();
 * myWebhook.handler('custom', { ... });
 */

import { createFactory } from './factory';

// Export errors
export * from './errors';

// Export signature utils
export * from './utils/signature';

// Export factory creator
export { createFactory };

/**
 * Default singleton instance of WebhookManager
 * @type {WebhookManager}
 */
const webhook = createFactory();

export default webhook;
