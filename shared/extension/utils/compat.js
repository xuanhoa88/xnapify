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
 * Two grants are never handed out on the manifest's word alone:
 * - {@link RESERVED_CAPABILITIES} are always denied, wildcard or not.
 * - `'*'` (everything else) is honoured only for an extension the *host*
 *   trusts, listed in `XNAPIFY_TRUSTED_EXTENSIONS`. The manifest is the
 *   extension's own package.json, so self-declared `'*'` is ignored.
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

/** Extensions already warned about an ungranted wildcard (log once each). */
const WILDCARD_WARNED = new Set();

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
  const raw = process.env.XNAPIFY_TRUSTED_EXTENSIONS;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

/**
 * Whether the host trusts this extension with the `'*'` capability.
 *
 * @param {Object} manifest - Extension manifest (package.json)
 * @returns {boolean}
 */
export function isTrustedExtension(manifest) {
  if (!manifest) return false;
  const trusted = getTrustedExtensionIds();
  if (trusted.length === 0) return false;
  return (
    (typeof manifest.id === 'string' && trusted.includes(manifest.id)) ||
    (typeof manifest.name === 'string' && trusted.includes(manifest.name))
  );
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
 * plus whatever it declared, minus the reserved bindings, minus an
 * untrusted `'*'`.
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
    if (cap === WILDCARD_CAPABILITY && !isTrustedExtension(manifest)) {
      const label = (manifest && (manifest.id || manifest.name)) || 'extension';
      if (!WILDCARD_WARNED.has(label)) {
        WILDCARD_WARNED.add(label);
        console.warn(
          `[ExtensionCompat] "${label}" declares the "*" capability, which is ` +
            'granted only to extensions listed in XNAPIFY_TRUSTED_EXTENSIONS. ' +
            'Falling back to its other declared capabilities.',
        );
      }
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
