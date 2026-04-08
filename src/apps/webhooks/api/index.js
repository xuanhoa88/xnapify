/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Webhooks Module Entry Point
 *
 * This module owns the webhook engine: factory, errors, signature utilities,
 * and API routes for inbound webhook handling and admin management.
 *
 * ## What This Module Does
 *
 * 1. **providers()** — Binds the `WebhookManager` to DI as `'webhook'`
 * 2. **boot()** — Forces initialization so it's ready for extensions
 * 3. **routes()** — Exposes admin and inbound webhook routes
 */

import { createFactory } from './factory';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.webhooks.api__');

// Auto-load contexts
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  routes: () => routesContext,

  async providers({ container }) {
    // Lazy binding — webhook manager needs hook engine which is available at resolve time
    container.bind(
      'webhook',
      c => {
        const manager = createFactory();
        manager.withContext(c);
        return manager;
      },
      OWNER_KEY,
    );
  },

  async boot({ container }) {
    // Force initialization so webhook is ready for extensions
    container.resolve('webhook');
    console.info('[Webhooks] ✅ Initialized');
  },
};
