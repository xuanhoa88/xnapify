/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * In-process broker adapter.
 *
 * Delivery is local: `publish` only reaches `subscribe` calls made against
 * the same instance (or instances sharing the same `bus`, which is how tests
 * simulate several workers — see `broker.test.js`). There is no cross-process
 * fan-out, which is correct for a single-instance deployment and for tests;
 * a multi-instance deployment needs the `redis` adapter (or another adapter
 * backed by a real broker) instead.
 *
 * `getClient()`/`isConfigured()` exist only so a consumer can treat every
 * adapter uniformly without a type check — there is no KV/lock surface to
 * back them, so they report "not configured" rather than pretending to.
 */

import { EventEmitter } from 'events';

class MemoryBroker {
  /**
   * @param {Object} [options]
   * @param {EventEmitter} [options.bus] - Shared event bus (multi-instance tests)
   */
  constructor({ bus } = {}) {
    this.bus = bus || new EventEmitter();
    this.bus.setMaxListeners(0);
    /** @type {Set<{channel: string, handler: Function}>} Own subscriptions */
    this.subscriptions = new Set();
  }

  isConfigured() {
    return false;
  }

  /** No KV/lock-capable client backs this adapter. */
  getClient() {
    return null;
  }

  /** No connection to lose or recover; nothing to notify. */
  onReconnect() {
    return () => {};
  }

  /** In-process delivery cannot drop out from under a subscriber. */
  onDisconnect() {
    return () => {};
  }

  /** No deployment-level namespacing to apply; the name passes through. */
  channel(name) {
    return name;
  }

  /** Nothing is namespaced, so there is no prefix in effect. */
  getKeyPrefix() {
    return '';
  }

  /**
   * @param {string} channel
   * @param {string} payload
   * @returns {Promise<void>}
   */
  async publish(channel, payload) {
    this.bus.emit(channel, payload);
  }

  /**
   * @param {string} channel
   * @param {(payload: string) => void} onMessage
   * @returns {Promise<() => Promise<void>>} Unsubscribe function
   */
  async subscribe(channel, onMessage) {
    const handler = payload => onMessage(payload);
    const entry = { channel, handler };
    this.bus.on(channel, handler);
    this.subscriptions.add(entry);
    return async () => {
      this.bus.off(channel, handler);
      this.subscriptions.delete(entry);
    };
  }

  /**
   * Drop only this instance's own subscriptions.
   *
   * The bus can be shared between instances (that is how several workers are
   * simulated), so `removeAllListeners()` here would silently tear down every
   * *other* instance's fan-out too — the same mistake the adapter contract
   * warns against for a shared Redis subscriber connection.
   */
  async cleanup() {
    for (const { channel, handler } of this.subscriptions) {
      this.bus.off(channel, handler);
    }
    this.subscriptions.clear();
  }
}

export default MemoryBroker;
