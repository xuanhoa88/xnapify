/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Facebook Webhook Extension
 *
 * Registers a Facebook webhook handler so incoming Facebook events
 * (page updates, messaging, etc.) are automatically verified and dispatched.
 *
 * ## How It Works
 *
 * 1. Extension `boot()` resolves the webhook engine from the DI container
 * 2. Calls `webhook.handler('facebook', { secret, signatureHeader, handler })`
 * 3. Facebook sends POST requests to `/webhooks/facebook`
 * 4. The webhook engine auto-verifies the HMAC signature using `x-hub-signature-256`
 * 5. On valid signature, the handler receives the parsed payload
 *
 * ## Environment Variables
 *
 * - `XNAPIFY_FACEBOOK_WEBHOOK_KEY` — Shared secret from Facebook App Dashboard
 *
 * @example <caption>Sending a test webhook</caption>
 * curl -X POST http://localhost:3000/webhooks/facebook \
 *   -H "Content-Type: application/json" \
 *   -H "x-hub-signature-256: sha256=<hmac>" \
 *   -d '{"object":"page","entry":[...]}'
 */

// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

const TAG = '[Facebook Extension]';

export default {
  // Store handlers for cleanup
  [HANDLERS]: {},

  /**
   * Boot — register the Facebook webhook handler.
   *
   * @param {Object} registry - Extension registry
   * @param {Object} context - App context
   */
  async boot({ container }) {
    const webhook = container.resolve('webhook');

    const secret = process.env.XNAPIFY_FACEBOOK_WEBHOOK_KEY;

    if (!secret) {
      console.warn(
        `${TAG} ⚠️ XNAPIFY_FACEBOOK_WEBHOOK_KEY not set — skipping handler registration`,
      );
      return;
    }

    // Store the handler function for proper cleanup in destroy()
    // ctx is auto-injected by WebhookManager.dispatch() with { headers, query, ip, app }
    this[HANDLERS].facebookHandler = async payload => {
      const { object, entry } = payload || {};

      console.info(`${TAG} Received event: object=${object}`);

      if (object === 'page' && Array.isArray(entry)) {
        for (const event of entry) {
          const { id, time, messaging, changes } = event;

          // Process messaging events (e.g. messages, postbacks)
          if (Array.isArray(messaging)) {
            for (const msg of messaging) {
              console.info(
                `${TAG} Messaging event from page ${id}:`,
                msg.message ? 'message' : 'postback',
              );

              // Emit to hook engine so other modules can observe
              const hook = container.resolve('hook');
              if (hook) {
                hook('facebook').emit('messaging', {
                  pageId: id,
                  timestamp: time,
                  ...msg,
                });
              }
            }
          }

          // Process feed/page changes
          if (Array.isArray(changes)) {
            for (const change of changes) {
              console.info(
                `${TAG} Change event: field=${change.field} from page ${id}`,
              );

              const hook = container.resolve('hook');
              if (hook) {
                hook('facebook').emit('change', {
                  pageId: id,
                  timestamp: time,
                  ...change,
                });
              }
            }
          }
        }
      }
    };

    // Register with the webhook engine
    webhook.handler('facebook', {
      secret,
      signatureHeader: 'x-hub-signature-256',
      handler: this[HANDLERS].facebookHandler,
    });

    console.info(
      `${TAG} ✅ Initialized — listening on POST /webhooks/facebook`,
    );
  },

  /**
   * Shutdown — remove the Facebook webhook handler.
   *
   * @param {Object} registry - Extension registry
   * @param {Object} context - App context
   */
  async shutdown({ container }) {
    const webhook = container.resolve('webhook');
    webhook.removeHandler('facebook');

    // Clear handlers
    this[HANDLERS] = {};

    console.info(`${TAG} 🗑️ Destroyed — Facebook webhook handler removed`);
  },
};
