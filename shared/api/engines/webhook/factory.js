/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { WebhookValidationError } from './errors';
import { WEBHOOK_EVENTS } from './utils/constants';

// Private symbols
const HOOK = Symbol('__rsk.webhookChannel__');
const PROVIDERS = Symbol('__rsk.webhookProviders__');
const CONTEXT = Symbol('__rsk.webhookContext__');

/**
 * Inbound Webhook Manager
 *
 * Manages webhook handler registration and dispatch for incoming
 * 3rd-party service events (Stripe, GitHub, Facebook, etc.).
 *
 * Uses the hook engine's HookChannel for priority-based handler execution
 * and stores provider configurations (secret, signatureHeader) for
 * automatic signature verification in the controller.
 */
class WebhookManager {
  constructor() {
    /** @type {HookChannel|null} Injected via withContext() */
    this[HOOK] = null;

    /** @type {Object|null} App context (proxy) from bootstrap */
    this[CONTEXT] = null;

    /** @type {Map<string, { secret: string, signatureHeader: string }> } */
    this[PROVIDERS] = new Map();
  }

  /**
   * Bind this manager to an application context.
   *
   * Called automatically by `registerEngines()` during bootstrap.
   * Resolves the shared hook engine from the context and creates
   * the 'webhook' channel for handler dispatch.
   *
   * @param {Object} context - Application context (proxy)
   * @param {Function} context.get - Provider getter
   * @returns {WebhookManager} this (for chaining)
   */
  withContext(context) {
    this[CONTEXT] = context;
    const hook = context.get('hook');
    this[HOOK] = hook('webhook');
    return this;
  }

  /**
   * Register a provider handler with secret protection.
   *
   * @param {string} provider - Provider name (e.g. 'stripe', 'github')
   * @param {Object} config - Handler configuration
   * @param {string} config.secret - Shared secret for HMAC signature verification
   * @param {string} [config.signatureHeader='x-webhook-signature'] - Request header containing the signature
   * @param {Function} config.handler - Async handler(payload, context)
   * @param {number} [config.priority=10] - Execution priority (lower runs first)
   * @returns {WebhookManager} For chaining
   * @throws {WebhookValidationError} If config is invalid
   *
   * @example
   * webhook.handler('stripe', {
   *   secret: process.env.STRIPE_WEBHOOK_SECRET,
   *   signatureHeader: 'stripe-signature',
   *   handler: async (payload, context) => {
   *     await processStripeEvent(payload);
   *   },
   * });
   */
  handler(provider, config) {
    if (!provider || typeof provider !== 'string') {
      throw new WebhookValidationError(
        'Provider must be a non-empty string',
        'provider',
      );
    }

    if (!config || typeof config !== 'object') {
      throw new WebhookValidationError(
        'Config must be an object with { secret, handler }',
        'config',
      );
    }

    const {
      secret,
      signatureHeader = 'x-webhook-signature',
      handler: handlerFn,
      priority = 10,
    } = config;

    if (!secret || typeof secret !== 'string') {
      throw new WebhookValidationError(
        'Secret is required for webhook signature verification',
        'secret',
      );
    }

    if (typeof handlerFn !== 'function') {
      throw new WebhookValidationError('Handler must be a function', 'handler');
    }

    // Store provider config for controller verification
    this[PROVIDERS].set(provider, {
      secret,
      signatureHeader: signatureHeader.toLowerCase(),
    });

    // Register handler on the hook channel
    const hookId = `${WEBHOOK_EVENTS.HANDLER}:${provider}`;
    this[HOOK].on(hookId, handlerFn, priority);

    console.info(`✅ Registered webhook handler: ${provider}`);
    return this;
  }

  /**
   * Remove a provider handler (revokes webhook access).
   *
   * After removal, the endpoint returns 404 for this provider.
   *
   * @param {string} provider - Provider name
   * @returns {WebhookManager} For chaining
   */
  removeHandler(provider) {
    this[PROVIDERS].delete(provider);

    const hookId = `${WEBHOOK_EVENTS.HANDLER}:${provider}`;
    this[HOOK].off(hookId);

    console.info(`🗑️ Removed webhook handler: ${provider}`);
    return this;
  }

  /**
   * Check if a provider handler is registered.
   *
   * @param {string} provider - Provider name
   * @returns {boolean}
   */
  hasHandler(provider) {
    return this[PROVIDERS].has(provider);
  }

  /**
   * Get provider configuration (secret, signatureHeader).
   *
   * @param {string} provider - Provider name
   * @returns {{ secret: string, signatureHeader: string }|null}
   */
  getProviderConfig(provider) {
    return this[PROVIDERS].get(provider) || null;
  }

  /**
   * List all registered provider names.
   *
   * @returns {string[]}
   */
  getProviders() {
    return Array.from(this[PROVIDERS].keys());
  }

  /**
   * Dispatch an incoming webhook to registered handlers.
   *
   * Called by the controller after signature verification passes.
   * Executes lifecycle hooks (beforeHandle → handler → afterHandle)
   * sequentially in priority order.
   *
   * @param {string} provider - Provider name
   * @param {*} payload - Parsed request body
   * @param {Object} context - Request context
   * @param {Object} context.headers - Request headers
   * @param {Object} context.query - Query parameters
   * @param {string} context.ip - Client IP
   * @returns {Promise<void>}
   */
  async dispatch(provider, payload, context) {
    // Merge app context so handlers get (payload, { headers, query, ip, app })
    const enrichedContext = { ...context, app: this[CONTEXT] };

    // beforeHandle lifecycle hook
    await this[HOOK].emit(WEBHOOK_EVENTS.BEFORE_HANDLE, {
      provider,
      payload,
      ...enrichedContext,
    });

    // Provider handler(s)
    const hookId = `${WEBHOOK_EVENTS.HANDLER}:${provider}`;
    await this[HOOK].emit(hookId, payload, enrichedContext);

    // afterHandle lifecycle hook
    await this[HOOK].emit(WEBHOOK_EVENTS.AFTER_HANDLE, {
      provider,
      payload,
      ...enrichedContext,
    });
  }

  /**
   * Register a lifecycle hook (beforeHandle, afterHandle).
   *
   * @param {string} event - Event name from WEBHOOK_EVENTS
   * @param {Function} handlerFn - Async handler
   * @param {number} [priority=10] - Priority (lower runs first)
   * @returns {WebhookManager} For chaining
   *
   * @example
   * webhook.on('afterHandle', async ({ provider, payload }) => {
   *   console.log(`Processed webhook from ${provider}`);
   * });
   */
  on(event, handlerFn, priority = 10) {
    this[HOOK].on(event, handlerFn, priority);
    return this;
  }

  /**
   * Remove a lifecycle hook.
   *
   * @param {string} event - Event name
   * @param {Function} [handlerFn] - Specific handler, or all if omitted
   * @returns {WebhookManager} For chaining
   */
  off(event, handlerFn) {
    this[HOOK].off(event, handlerFn);
    return this;
  }

  /**
   * Clear all handlers and provider configs.
   */
  cleanup() {
    if (this[HOOK]) {
      this[HOOK].off();
    }
    this[PROVIDERS].clear();
    console.info('🧹 Webhook engine cleanup complete');
  }
}

/**
 * Create a new isolated WebhookManager instance.
 *
 * @returns {WebhookManager}
 */
export function createFactory() {
  return new WebhookManager();
}
