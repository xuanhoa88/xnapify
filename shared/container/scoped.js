/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Capability-scoped view of a container.
 *
 * Extensions run in-process, so the only isolation available is what the
 * host chooses to hand them. A scoped container exposes `resolve()` and
 * `has()` for an allow-list of binding names and nothing else — no
 * registration, no reset, no cleanup — so an extension can use the
 * services it declared and cannot rebind or remove anyone else's.
 *
 * The allow-list is a set of binding names. `'*'` grants everything the deny
 * list does not take back (the caller decides who may declare it — see
 * `getGrantedCapabilities`). A trailing `:*` grants a namespace, e.g.
 * `users:*` matches `users:sessions`.
 *
 * The optional deny list wins over every grant, wildcard included, so a
 * binding the host reserves for itself stays unreachable no matter what the
 * allow-list says.
 */

/**
 * Error raised when an extension resolves a binding it did not declare.
 */
export class CapabilityDeniedError extends Error {
  constructor(name, owner) {
    super(
      `Capability "${name}" is not granted to ${owner}. ` +
        `Declare it under "xnapify.capabilities" in the extension manifest.`,
    );
    this.name = 'CapabilityDeniedError';
    this.code = 'E_CAPABILITY_DENIED';
    this.status = 403;
    this.capability = name;
    this.owner = owner;
  }
}

/**
 * Compile an allow-list into a matcher.
 *
 * @param {Iterable<string>} capabilities
 * @param {Object} [options]
 * @param {Iterable<string>} [options.deny] - Names refused even under `'*'`
 * @returns {(name: string) => boolean}
 */
export function createCapabilityMatcher(capabilities, { deny } = {}) {
  const exact = new Set();
  const prefixes = [];
  const denied = new Set(
    [...(deny || [])].filter(name => typeof name === 'string' && name.trim()),
  );
  let all = false;

  for (const raw of capabilities || []) {
    if (typeof raw !== 'string') continue;
    const cap = raw.trim();
    if (!cap) continue;
    if (cap === '*') {
      all = true;
    } else if (cap.endsWith(':*')) {
      prefixes.push(cap.slice(0, -1)); // keep the trailing ':'
    } else {
      exact.add(cap);
    }
  }

  return name =>
    !denied.has(name) &&
    (all ||
      exact.has(name) ||
      prefixes.some(
        prefix => typeof name === 'string' && name.startsWith(prefix),
      ));
}

/**
 * Create a read-only, capability-filtered facade over a container.
 *
 * @param {Object} container - Any object with `resolve(name)` and `has(name)`
 * @param {Iterable<string>} capabilities - Allowed binding names
 * @param {Object} [options]
 * @param {string} [options.owner='extension'] - Name used in error messages
 * @param {Iterable<string>} [options.deny] - Bindings refused even under `'*'`
 * @returns {{ resolve: Function, has: Function, getBindingNames: Function, capabilities: string[] }}
 */
export function createScopedContainer(
  container,
  capabilities,
  { owner = 'extension', deny } = {},
) {
  if (!container || typeof container.resolve !== 'function') {
    throw new TypeError('createScopedContainer requires a container');
  }

  const allowed = createCapabilityMatcher(capabilities, { deny });
  const granted = Object.freeze([...new Set(capabilities || [])]);

  return Object.freeze({
    /** Declared capabilities (for diagnostics) */
    capabilities: granted,

    /**
     * Resolve a binding the extension is allowed to use.
     * @param {string} name
     * @throws {CapabilityDeniedError}
     */
    resolve(name) {
      if (!allowed(name)) {
        throw new CapabilityDeniedError(name, owner);
      }
      return container.resolve(name);
    },

    /**
     * True only when the binding exists AND is granted.
     * @param {string} name
     */
    has(name) {
      if (!allowed(name)) return false;
      return typeof container.has === 'function' ? container.has(name) : true;
    },

    /** Granted binding names that currently exist on the underlying container */
    getBindingNames() {
      const names =
        typeof container.getBindingNames === 'function'
          ? container.getBindingNames()
          : [];
      return names.filter(allowed);
    },
  });
}
