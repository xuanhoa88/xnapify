/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Per-extension view of the shared registry.
 *
 * Two jobs, both about identity:
 *
 * 1. Registration calls are tagged with the calling extension's id, so an
 *    extension never has to pass (or forge) it.
 * 2. Removal is limited to that extension's own registrations, so one
 *    extension cannot disable another's slots, hooks or handlers.
 *
 * This has no dependency on the extension manager: it is a pure function of a
 * registry and an id, which is why it lives here rather than as a method.
 */

/**
 * Bind the given method names of `target`, skipping ones it lacks.
 *
 * Tolerating missing methods keeps minimal test registries usable without
 * stubbing the whole surface.
 *
 * @param {Object} target
 * @param {string[]} names
 * @returns {Object<string, Function>}
 */
export function bindPassthrough(target, names) {
  const bound = {};
  for (const name of names) {
    if (typeof target[name] === 'function') {
      bound[name] = target[name].bind(target);
    }
  }
  return bound;
}

/** Methods forwarded to the shared registry unchanged. */
export const PASSTHROUGH_METHODS = Object.freeze([
  'getSlotEntries',
  'executeHook',
  'executeHookParallel',
  'hasHook',
  'invokeHandler',
  'hasHandler',
  'getHandlerMeta',
  'subscribe',
  'notify',
  'createPipeline',
]);

/**
 * Refuse an ownership-checked removal, warning instead of throwing so a
 * misbehaving shutdown cannot abort the rest of the teardown.
 *
 * @param {string} extensionId
 * @param {string} kind - 'slot' | 'hook' | 'handler'
 * @param {string} id
 */
function warnNotOwned(extensionId, kind, id) {
  console.warn(
    `[ExtensionRegistry] "${extensionId}" tried to unregister a ${kind} it does not own: ${id}`,
  );
}

/**
 * Build the scoped registry an extension receives in its lifecycle context.
 *
 * @param {Object} registry - The shared ExtensionRegistry
 * @param {string} extensionId - Owner of every registration made through it
 * @returns {Object} Scoped registry facade
 */
export function createScopedRegistry(registry, extensionId) {
  if (!registry) {
    throw new TypeError('createScopedRegistry requires a registry');
  }
  if (!extensionId) {
    throw new TypeError('createScopedRegistry requires an extensionId');
  }

  return {
    // ---- Registration: the extension id is injected, never supplied --------

    registerSlot(slotId, component, options = {}) {
      return registry.registerSlot(slotId, component, {
        ...options,
        extensionId,
      });
    },

    /** Collector extension point: many extensions may contribute. */
    registerHook(hookId, callback, options = {}) {
      return registry.registerHook(hookId, callback, extensionId, options);
    },

    /**
     * Request/response extension point: this extension owns the id.
     * Pass `{ public: true }` to allow unauthenticated IPC callers.
     */
    registerHandler(handlerId, callback, options = {}) {
      return registry.registerHandler(
        handlerId,
        callback,
        extensionId,
        options,
      );
    },

    // ---- Removal: limited to this extension's own registrations ------------

    unregisterSlot(slotId, component) {
      if (
        typeof registry.ownsSlot === 'function' &&
        !registry.ownsSlot(extensionId, slotId, component)
      ) {
        warnNotOwned(extensionId, 'slot', slotId);
        return registry;
      }
      return registry.unregisterSlot(slotId, component);
    },

    unregisterHook(hookId, callback) {
      if (typeof callback !== 'function') {
        // Hooks are keyed by callback identity, so an id alone cannot identify
        // what to remove. Silently doing nothing here used to read as cleanup.
        console.warn(
          `[ExtensionRegistry] "${extensionId}" called unregisterHook("${hookId}") ` +
            'without the callback. Hooks are removed by reference, so keep the ' +
            'function you registered, or use registerHandler for single-answer ids.',
        );
        return registry;
      }
      if (
        typeof registry.ownsHook === 'function' &&
        !registry.ownsHook(extensionId, hookId, callback)
      ) {
        warnNotOwned(extensionId, 'hook', hookId);
        return registry;
      }
      return registry.unregisterHook(hookId, callback);
    },

    unregisterHandler(handlerId) {
      if (
        typeof registry.ownsHandler === 'function' &&
        !registry.ownsHandler(extensionId, handlerId)
      ) {
        warnNotOwned(extensionId, 'handler', handlerId);
        return registry;
      }
      return registry.unregisterHandler(handlerId);
    },

    ...bindPassthrough(registry, PASSTHROUGH_METHODS),
  };
}

export default createScopedRegistry;
