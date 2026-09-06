/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Extension ↔ host compatibility contract (server side).
 *
 * Every extension manifest must declare the host versions it was written
 * for and the container bindings it needs:
 *
 * ```json
 * {
 *   "name": "@acme/reports",
 *   "xnapify": {
 *     "version": "^2.0.0",
 *     "capabilities": ["db", "models", "hook"]
 *   }
 * }
 * ```
 *
 * `version` is a semver range checked against the running host.
 * `capabilities` is the allow-list handed to `createScopedContainer()`.
 *
 * Grants are ADDITIVE: every extension always receives
 * {@link DEFAULT_EXTENSION_CAPABILITIES} (side-effect-free services), and a
 * declaration adds to that baseline rather than replacing it. So a missing
 * block, an empty array and `["hook"]` all still resolve `hook`, and
 * `["db"]` means "the defaults plus db".
 *
 * Three grants are never handed out on the manifest's word alone:
 * - {@link RESERVED_CAPABILITIES} are always denied, wildcard or not.
 * - `'*'` (everything else) is honoured only for an extension the *host*
 *   trusts, listed in `XNAPIFY_TRUSTED_EXTENSIONS`. The manifest is the
 *   extension's own package.json, so self-declared `'*'` is ignored.
 * - {@link PRIVILEGED_CAPABILITIES} (`db`, `models`, `worker`, …) are honoured
 *   only for an extension the host trusts *or* one bundled with this build
 *   ({@link isPrivilegedExtension}). Gating `'*'` and not `["db"]` barred the
 *   door and left the window open: both reach `users.password`, and a
 *   hub-installed package writes either one into its own manifest. An
 *   ungranted privileged capability is dropped; the rest of the declaration
 *   still applies.
 */

import semver from 'semver';

/** Bindings an extension may use without declaring anything. */
export const DEFAULT_EXTENSION_CAPABILITIES = Object.freeze([
  'hook',
  'cache',
  'http',
  'template',
  'i18n',
]);

/**
 * Bindings that must never be granted to an extension.
 *
 * Enforced twice: stripped from the declared list here, and passed to
 * `createScopedContainer({ deny })` so `'*'` cannot resolve them either.
 */
export const RESERVED_CAPABILITIES = Object.freeze(['extension', 'jwt', 'env']);

/** Capability that grants every non-reserved binding. Trusted extensions only. */
export const WILDCARD_CAPABILITY = '*';

/**
 * Bindings that are never granted on the manifest's word alone, however
 * narrowly they are declared.
 *
 * The wildcard argument applies unchanged here: `capabilities` is the
 * extension's own package.json, read verbatim at install with no operator
 * approval, so `["db"]` is as much a self-grant as `["*"]` — it just reaches
 * `users.password` through a smaller door.
 *
 * The line, drawn over the engines in `shared/api/engines/`, is "can this
 * reach user data, or run arbitrary work off-request":
 * - `db` — the raw Sequelize connection, `query()` included.
 * - `models` — User, RefreshToken and every other row.
 * - `worker` — runs the extension's own code in the thread pool.
 * - `queue` — the same work, deferred: it outlives the request that enqueued it.
 * - `schedule` — cron registration; runs with no request behind it at all.
 * - `fs` — streams the host's storage, which is every user's uploads.
 * - `redis` — the shared cache, rate-limit counters and the session denylist;
 *   writing it is enough to un-revoke a session.
 *
 * Deliberately left out:
 * - `auth` — this is how an extension guards *its own* routes
 *   (`requirePermission`). Gating it would not protect users; it would produce
 *   extensions that ship unguarded routes instead. Its `revocation` surface is
 *   the one thing here that argues the other way.
 * - `email` — one fixed operation with no read path into user data.
 * - `http`, `cache`, `template`, `i18n`, `hook` — the defaults every extension
 *   already has; side-effect-free or scoped by construction.
 *
 * Not mirrored in `src/apps/extensions/api/utils/capabilities.util.js`: that
 * analyzer answers "is this binding declared", which privilege does not change.
 */
export const PRIVILEGED_CAPABILITIES = Object.freeze([
  'db',
  'models',
  'worker',
  'queue',
  'schedule',
  'fs',
  'redis',
]);

/**
 * Capabilities already warned about, keyed by extension + capability so each
 * dropped grant is reported once instead of on every container scope.
 */
const CAPABILITY_WARNED = new Set();

/**
 * Split a comma-separated id/name list from the environment.
 *
 * @param {string|undefined} raw
 * @returns {string[]}
 */
function splitIdList(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

/**
 * Whether a manifest identifies itself as one of `ids` (id or package name).
 *
 * @param {Object} manifest
 * @param {string[]} ids
 * @returns {boolean}
 */
function matchesIdList(manifest, ids) {
  if (!manifest || ids.length === 0) return false;
  return (
    (typeof manifest.id === 'string' && ids.includes(manifest.id)) ||
    (typeof manifest.name === 'string' && ids.includes(manifest.name))
  );
}

/**
 * Emit the one warning an extension gets for a capability it declared but
 * does not receive.
 *
 * @param {Object} manifest
 * @param {string} capability
 * @param {string} reason - Sentence completing "…, which {reason}"
 */
function warnUngranted(manifest, capability, reason) {
  const label = (manifest && (manifest.id || manifest.name)) || 'extension';
  const key = `${label}\u0000${capability}`;
  if (CAPABILITY_WARNED.has(key)) return;
  CAPABILITY_WARNED.add(key);
  console.warn(
    `[ExtensionCompat] "${label}" declares the "${capability}" capability, ` +
      `which ${reason} Falling back to its other declared capabilities.`,
  );
}

/**
 * Whether a declared capability reaches a privileged binding.
 *
 * Deliberately more conservative than `createCapabilityMatcher` itself: the
 * container only treats a trailing `":*"` as a namespace prefix (`"users:*"`
 * matches `"users:sessions"`), so today a bare `"d*"` grants nothing there —
 * it is stored as the literal string and never matches `"db"`. This function
 * refuses any capability ending in `"*"` that COULD cover a privileged name if
 * that matching ever broadened, rather than depending on the matcher's exact
 * syntax to keep the gate closed.
 *
 * @param {string} capability
 * @returns {boolean}
 */
export function isPrivilegedCapability(capability) {
  if (typeof capability !== 'string') return false;
  const cap = capability.trim();
  if (PRIVILEGED_CAPABILITIES.includes(cap)) return true;
  if (cap.endsWith('*')) {
    const prefix = cap.slice(0, -1);
    return PRIVILEGED_CAPABILITIES.some(name => name.startsWith(prefix));
  }
  return false;
}

/**
 * Extension ids/names the host operator has explicitly trusted, read from
 * `XNAPIFY_TRUSTED_EXTENSIONS` (comma-separated ids or package names).
 *
 * Trust cannot come from the manifest: it is the extension's own
 * package.json, read verbatim with no approval step.
 *
 * @returns {string[]}
 */
export function getTrustedExtensionIds() {
  return splitIdList(process.env.XNAPIFY_TRUSTED_EXTENSIONS);
}

/**
 * Whether the host trusts this extension with the `'*'` capability.
 *
 * @param {Object} manifest - Extension manifest (package.json)
 * @returns {boolean}
 */
export function isTrustedExtension(manifest) {
  return matchesIdList(manifest, getTrustedExtensionIds());
}

/**
 * Ids and package names of the extensions that ship with this host build,
 * injected by `createDefinePlugin` in `tools/rspack/base.config.js`.
 *
 * These come from `src/extensions/`: they are compiled by the host's own build
 * and covered by its review, so they are trusted by construction in a way
 * nothing installed from the hub at runtime can be. Both forms are listed
 * because a manifest is matched on either, exactly like the trusted env list.
 *
 * Read with the same defensive shape as {@link getHostVersion}: outside a
 * bundle (jest, plain-node tooling) the define does not exist, so fall back to
 * the environment. That fallback is not an operator knob — it is the value the
 * build would have injected.
 *
 * @returns {string[]}
 */
export function getBundledExtensionIds() {
  if (
    typeof __XNAPIFY_BUNDLED_EXTENSIONS__ !== 'undefined' &&
    Array.isArray(__XNAPIFY_BUNDLED_EXTENSIONS__)
  ) {
    return __XNAPIFY_BUNDLED_EXTENSIONS__
      .filter(entry => typeof entry === 'string' && entry.trim())
      .map(entry => entry.trim());
  }
  return splitIdList(process.env.XNAPIFY_BUNDLED_EXTENSIONS);
}

/**
 * Whether this extension shipped with the host build.
 *
 * @param {Object} manifest - Extension manifest (package.json)
 * @returns {boolean}
 */
export function isBundledExtension(manifest) {
  return matchesIdList(manifest, getBundledExtensionIds());
}

/**
 * Whether the host trusts this extension with {@link PRIVILEGED_CAPABILITIES}:
 * the operator's `XNAPIFY_TRUSTED_EXTENSIONS` list *or* the set bundled with
 * this build.
 *
 * Deliberately a separate predicate from {@link isTrustedExtension} rather than
 * a widened one. `'*'` hands over every non-reserved binding at once, including
 * ones added long after an extension was reviewed; a named `db` does not. The
 * two gates answer different questions, so widening this one must not silently
 * hand `'*'` to every bundled extension.
 *
 * @param {Object} manifest - Extension manifest (package.json)
 * @returns {boolean}
 */
export function isPrivilegedExtension(manifest) {
  return isTrustedExtension(manifest) || isBundledExtension(manifest);
}

/**
 * Version of the running host. Injected at build time; falls back to the
 * environment for tooling and tests.
 *
 * @returns {string}
 */
export function getHostVersion() {
  if (typeof __XNAPIFY_VERSION__ === 'string') return __XNAPIFY_VERSION__;
  return process.env.XNAPIFY_VERSION || '0.0.0';
}

/**
 * Normalise the `xnapify` block of a manifest.
 *
 * `capabilities` here is what the manifest *declared* (the defaults when it
 * declared nothing at all); {@link getGrantedCapabilities} turns that into
 * what the extension is actually allowed to resolve.
 *
 * @param {Object} manifest
 * @returns {{ version: string|null, capabilities: string[] }}
 */
export function getManifestContract(manifest) {
  const block =
    manifest && manifest.xnapify && typeof manifest.xnapify === 'object'
      ? manifest.xnapify
      : {};
  const version =
    typeof block.version === 'string' && block.version.trim()
      ? block.version.trim()
      : null;
  const declared = Array.isArray(block.capabilities)
    ? block.capabilities.filter(c => typeof c === 'string' && c.trim())
    : null;

  return {
    version,
    capabilities: declared
      ? declared.map(c => c.trim())
      : [...DEFAULT_EXTENSION_CAPABILITIES],
  };
}

/**
 * Capabilities an extension actually receives: the side-effect-free defaults
 * plus whatever it declared, minus the reserved bindings, minus an untrusted
 * `'*'`, minus any {@link PRIVILEGED_CAPABILITIES} the host has not vouched for.
 *
 * Additive so that `capabilities: []` (or a narrow list) still resolves the
 * baseline services every extension needs, rather than silently granting
 * nothing.
 *
 * @param {Object} manifest
 * @returns {string[]}
 */
export function getGrantedCapabilities(manifest) {
  const { capabilities } = getManifestContract(manifest);
  const granted = new Set(DEFAULT_EXTENSION_CAPABILITIES);

  for (const cap of capabilities) {
    if (RESERVED_CAPABILITIES.includes(cap)) continue;
    if (cap === WILDCARD_CAPABILITY) {
      if (!isTrustedExtension(manifest)) {
        warnUngranted(
          manifest,
          cap,
          'is granted only to extensions listed in XNAPIFY_TRUSTED_EXTENSIONS.',
        );
        continue;
      }
      granted.add(cap);
      continue;
    }
    if (isPrivilegedCapability(cap) && !isPrivilegedExtension(manifest)) {
      warnUngranted(
        manifest,
        cap,
        'reaches user data or off-request execution and is granted only to ' +
          'extensions bundled with this host build or listed in ' +
          'XNAPIFY_TRUSTED_EXTENSIONS.',
      );
      continue;
    }
    granted.add(cap);
  }

  return [...granted];
}

/**
 * Check whether a manifest is compatible with the running host.
 *
 * @param {Object} manifest - Extension manifest (package.json)
 * @param {string} [hostVersion] - Override for tests
 * @returns {{ ok: boolean, code?: string, reason?: string, required?: string, host: string }}
 */
export function checkHostCompatibility(
  manifest,
  hostVersion = getHostVersion(),
) {
  const host = semver.coerce(hostVersion);
  const { version: required } = getManifestContract(manifest);

  if (!required) {
    return {
      ok: false,
      code: 'MISSING_HOST_RANGE',
      reason:
        'Manifest does not declare "xnapify.version" (supported host range)',
      host: String(hostVersion),
    };
  }

  if (!semver.validRange(required)) {
    return {
      ok: false,
      code: 'INVALID_HOST_RANGE',
      reason: `"xnapify.version" is not a valid semver range: ${required}`,
      required,
      host: String(hostVersion),
    };
  }

  if (!host) {
    return {
      ok: false,
      code: 'UNKNOWN_HOST_VERSION',
      reason: `Host version "${hostVersion}" is not a valid semver version`,
      required,
      host: String(hostVersion),
    };
  }

  if (!semver.satisfies(host, required, { includePrerelease: true })) {
    return {
      ok: false,
      code: 'HOST_VERSION_MISMATCH',
      reason: `Extension requires host ${required}, running ${host.version}`,
      required,
      host: host.version,
    };
  }

  return { ok: true, required, host: host.version };
}

/**
 * True when `version` satisfies `range` (both semver). Invalid input is
 * treated as unsatisfied so a typo cannot silently widen a dependency.
 *
 * @param {string} version
 * @param {string} range
 * @returns {boolean}
 */
export function satisfiesRange(version, range) {
  if (!range || range === '*') return true;
  const parsed = semver.coerce(version);
  if (!parsed || !semver.validRange(range)) return false;
  return semver.satisfies(parsed, range, { includePrerelease: true });
}

/**
 * Build the error raised when an incompatible extension is loaded.
 *
 * @param {string} id - Extension id or name
 * @param {{ code?: string, reason?: string }} result - From checkHostCompatibility
 * @returns {Error}
 */
export function incompatibleExtensionError(id, result) {
  const error = new Error(
    `Extension "${id}" is not compatible with this host: ${result.reason}`,
  );
  error.name = 'IncompatibleExtensionError';
  error.code = result.code || 'INCOMPATIBLE_EXTENSION';
  error.status = 422;
  error.compatibility = result;
  return error;
}
