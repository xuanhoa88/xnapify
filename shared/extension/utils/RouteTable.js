/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Route adapters owned by extensions, across the view and API routers.
 *
 * Extensions can load before their router exists, so an adapter lives in one
 * of two places:
 *
 * - **buffered** — produced while the router was still null, replayed on connect
 * - **stored** — handed to a live router, kept so it can be replayed on
 *   reconnect and withdrawn when the extension unloads
 *
 * Keeping that in one place matters because losing track of an adapter leaves
 * a dead route serving a removed extension.
 */

/** Router keys this table understands. */
export const ROUTER_KEYS = Object.freeze(['views', 'api']);

/**
 * Normalise an external route type onto a router key.
 * @param {string} type
 * @returns {'views'|'api'}
 */
export function toRouterKey(type) {
  return type === 'api' ? 'api' : 'views';
}

class RouteTable {
  constructor() {
    // Only the two known keys, always present. The manager used to seed this
    // with a `view` key that nothing ever wrote to, while `views` was created
    // on demand.
    this.routers = { views: null, api: null };
    this.stored = new Map(); // extensionId -> { views?, api? }
    this.buffered = []; // [{ id, adapter, key }]
  }

  /**
   * The router connected for a key, or null.
   * @param {string} key
   * @returns {Object|null}
   */
  routerFor(key) {
    return this.routers[toRouterKey(key)] || null;
  }

  /**
   * Hold an adapter until its router connects.
   * @param {string} id - Extension id
   * @param {Object} adapter
   * @param {string} key - Router key
   */
  buffer(id, adapter, key) {
    this.buffered.push({ id, adapter, key: toRouterKey(key) });
  }

  /**
   * Record an adapter that is live on a router.
   * @param {string} id - Extension id
   * @param {Object} adapter
   * @param {string} key - Router key
   */
  store(id, adapter, key) {
    const routerKey = toRouterKey(key);
    if (!this.stored.has(id)) this.stored.set(id, {});
    this.stored.get(id)[routerKey] = adapter;
  }

  /**
   * Whether any adapter, live or pending, targets this router key.
   * @param {string} key - Router key
   * @returns {boolean}
   */
  has(key) {
    const routerKey = toRouterKey(key);
    for (const adapters of this.stored.values()) {
      if (adapters[routerKey]) return true;
    }
    return this.buffered.some(entry => entry.key === routerKey);
  }

  /**
   * Attach a router, promote everything buffered for it, then replay all of
   * its stored adapters.
   *
   * @param {string} key - Router key
   * @param {Object} router - Router with an `add(adapter)` method
   * @param {Function} [injectFn] - Custom injection `(router, adapter, id) => void`
   */
  connect(key, router, injectFn) {
    const routerKey = toRouterKey(key);
    this.routers[routerKey] = router;

    // Buffered entries for this key are now live; other keys keep waiting.
    const remaining = [];
    for (const entry of this.buffered) {
      if (entry.key === routerKey)
        this.store(entry.id, entry.adapter, routerKey);
      else remaining.push(entry);
    }
    this.buffered = remaining;

    if (!router) return;

    const inject = injectFn || ((r, adapter) => r.add(adapter));
    for (const [id, adapters] of this.stored.entries()) {
      if (adapters[routerKey]) inject(router, adapters[routerKey], id);
    }
  }

  /**
   * Withdraw every adapter belonging to an extension.
   *
   * Removal failures are reported through `onError` rather than thrown: this
   * runs during teardown, where one stuck router must not strand the rest.
   *
   * @param {string} id - Extension id
   * @param {Function} [removeFn] - Custom removal `(router, adapter, id) => void`
   * @param {Function} [onError] - `(error, routerKey) => void|Promise<void>`
   * @returns {Promise<void>}
   */
  async remove(id, removeFn, onError) {
    this.buffered = this.buffered.filter(entry => entry.id !== id);

    const adapters = this.stored.get(id);
    if (adapters) {
      const drop = removeFn || ((router, adapter) => router.remove(adapter));
      for (const routerKey of ROUTER_KEYS) {
        const router = this.routers[routerKey];
        if (!router || !adapters[routerKey]) continue;
        try {
          await drop(router, adapters[routerKey], id);
        } catch (error) {
          if (onError) await onError(error, routerKey);
        }
      }
    }

    this.stored.delete(id);
  }

  /** Forget every router, adapter and pending entry. */
  reset() {
    this.routers = { views: null, api: null };
    this.stored.clear();
    this.buffered = [];
  }
}

export default RouteTable;
