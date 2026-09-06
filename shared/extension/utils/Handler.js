/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Handler registry — request/response extension points (one answer).
 *
 * The counterpart to `Hook`. The difference is the contract, not the plumbing:
 *
 * - `Hook` is a collector. Many extensions contribute, every callback runs,
 *   failures are logged and dropped, and the caller merges what came back.
 *   Losing one contribution must not break a merged UI.
 * - `Handler` is a single answer. Exactly one extension owns an id, its error
 *   reaches the caller, and a second registration is a mistake worth failing
 *   on rather than a race decided by priority.
 *
 * Extension IPC is the main consumer: `POST /api/extensions/:id/ipc` resolves
 * `ipc:<extensionId>:<action>` to exactly one handler.
 */

/**
 * Raised when two extensions claim the same handler id.
 */
export class DuplicateHandlerError extends Error {
  constructor(handlerId, ownerId) {
    super(
      `Handler "${handlerId}" is already registered${
        ownerId ? ` by extension "${ownerId}"` : ''
      }. Handler ids answer a single caller, so they cannot be shared.`,
    );
    this.name = 'DuplicateHandlerError';
    this.code = 'E_DUPLICATE_HANDLER';
    this.status = 409;
    this.handlerId = handlerId;
    this.ownerId = ownerId;
  }
}

class Handler {
  constructor() {
    // Map<handlerId, { callback, extensionId, public }>
    this.handlers = new Map();
    // Map<extensionId, Set<handlerId>>
    this.registrations = new Map();
  }

  /**
   * Claim a handler id.
   *
   * Registering the same callback again is a no-op so boot stays idempotent.
   * A *different* callback on a claimed id throws, because silently keeping
   * one of the two would make the winner depend on load order.
   *
   * @param {string} handlerId - Handler identifier
   * @param {Function} callback - Handler function (may be async)
   * @param {string} [extensionId] - Owning extension, for auto-cleanup
   * @param {Object} [options]
   * @param {boolean} [options.public=false] - Allow unauthenticated callers
   * @returns {Handler} this
   * @throws {DuplicateHandlerError} When another callback already owns the id
   */
  register(
    handlerId,
    callback,
    extensionId,
    { public: isPublic = false } = {},
  ) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        `Handler "${handlerId}" requires a function, received ${typeof callback}`,
      );
    }

    const existing = this.handlers.get(handlerId);
    if (existing) {
      if (existing.callback === callback) return this; // idempotent re-boot
      throw new DuplicateHandlerError(handlerId, existing.extensionId);
    }

    this.handlers.set(handlerId, {
      callback,
      extensionId,
      public: isPublic === true,
    });

    if (extensionId) {
      if (!this.registrations.has(extensionId)) {
        this.registrations.set(extensionId, new Set());
      }
      this.registrations.get(extensionId).add(handlerId);
    }

    return this;
  }

  /**
   * Release a handler id.
   *
   * No callback argument: an id has one owner, so naming it is enough. This
   * is deliberately different from `Hook.unregister`, where passing only the
   * id cannot identify which of several callbacks to drop.
   *
   * @param {string} handlerId - Handler identifier
   * @returns {boolean} Whether a handler was removed
   */
  unregister(handlerId) {
    const entry = this.handlers.get(handlerId);
    if (!entry) return false;

    this.handlers.delete(handlerId);

    const owned = this.registrations.get(entry.extensionId);
    if (owned) {
      owned.delete(handlerId);
      if (owned.size === 0) this.registrations.delete(entry.extensionId);
    }
    return true;
  }

  /**
   * Whether `extensionId` owns this handler id.
   * @param {string} extensionId
   * @param {string} handlerId
   * @returns {boolean}
   */
  owns(extensionId, handlerId) {
    const entry = this.handlers.get(handlerId);
    return !!entry && entry.extensionId === extensionId;
  }

  /**
   * @param {string} handlerId
   * @returns {boolean}
   */
  has(handlerId) {
    return this.handlers.has(handlerId);
  }

  /**
   * Registration metadata.
   * @param {string} handlerId
   * @returns {Object} `{ public: boolean }`, or empty when unregistered
   */
  getMeta(handlerId) {
    const entry = this.handlers.get(handlerId);
    if (!entry) return {};
    return { public: entry.public };
  }

  /**
   * Call the handler and return its answer.
   *
   * Errors are NOT caught. The caller asked a question and needs to know that
   * the answer failed, so it can map the failure onto a real response.
   *
   * @param {string} handlerId - Handler identifier
   * @param {...any} args - Arguments passed to the handler
   * @returns {Promise<{handled: boolean, value: any, extensionId: string|undefined}>}
   *   `handled` is false only when nothing is registered. A handler that
   *   returns `undefined` still counts as handled.
   * @throws {*} Whatever the handler throws, unchanged
   */
  async invoke(handlerId, ...args) {
    const entry = this.handlers.get(handlerId);
    if (!entry) {
      return { handled: false, value: undefined, extensionId: undefined };
    }
    const value = await entry.callback(...args);
    return { handled: true, value, extensionId: entry.extensionId };
  }

  /**
   * List the ids owned by an extension.
   * @param {string} extensionId
   * @returns {string[]}
   */
  idsFor(extensionId) {
    return [...(this.registrations.get(extensionId) || [])];
  }

  /**
   * Drop handlers for one extension, or all of them.
   * @param {string} [extensionId]
   */
  clear(extensionId) {
    if (extensionId) {
      for (const handlerId of this.idsFor(extensionId)) {
        this.unregister(handlerId);
      }
      this.registrations.delete(extensionId);
      return;
    }
    this.handlers.clear();
    this.registrations.clear();
  }
}

export default Handler;
