/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { hashElement } from 'folder-hash';

/**
 * Manifest fields that describe the checksum itself, or the moment the build
 * ran. They are written *into* `package.json` after the hash is computed, so
 * hashing them is impossible by construction: the publisher would have to know
 * the checksum before producing it. They are stripped on both sides instead.
 */
export const SELF_REFERENTIAL_MANIFEST_FIELDS = Object.freeze([
  'integrity',
  'builtAt',
]);

/** Manifest filename — hashed separately from the rest of the tree. */
export const MANIFEST_FILE = 'package.json';

/** Domain separator so a folder hash can never be mistaken for a checksum. */
const CHECKSUM_PREFIX = 'xnapify-extension-checksum/v2';

/**
 * Default options for folder hashing.
 * Excludes volatile / non-source files so the checksum
 * only changes when the actual extension code changes.
 */
export const DEFAULT_OPTIONS = Object.freeze({
  algo: 'sha256',
  encoding: 'hex',
  folders: Object.freeze({
    exclude: Object.freeze(['node_modules', '.git', '__tests__', '__mocks__']),
  }),
  files: Object.freeze({
    // package.json is excluded from the *tree* hash and folded in separately
    // (see hashManifest): the built manifest carries the checksum of the very
    // tree it sits in, so it cannot contribute its own bytes to that hash.
    // Tampering with it is still detected — every other field is hashed.
    exclude: Object.freeze([
      '.DS_Store',
      'package-lock.json',
      'npm-debug.log',
      MANIFEST_FILE,
    ]),
  }),
});

/**
 * Deterministic JSON serialisation: object keys are emitted in sorted order so
 * two manifests with the same content hash the same regardless of key order or
 * formatting.
 *
 * @param {*} value - Any JSON-serialisable value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

/**
 * Hash a manifest object, ignoring the fields that describe the hash itself.
 *
 * @param {Object|null} manifest - Parsed package.json
 * @returns {string} Hex-encoded SHA-256 of the canonicalised manifest
 */
export function hashManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return 'no-manifest';
  const canonical = { ...manifest };
  for (const field of SELF_REFERENTIAL_MANIFEST_FIELDS) {
    delete canonical[field];
  }
  return crypto
    .createHash('sha256')
    .update(stableStringify(canonical))
    .digest('hex');
}

/**
 * Merge caller options over the defaults without letting a partial
 * `folders`/`files` object drop the default exclusions.
 *
 * @param {Object} options
 * @returns {Object} folder-hash options
 */
function mergeHashOptions(options) {
  const folders = options.folders || {};
  const files = options.files || {};
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    folders: {
      ...DEFAULT_OPTIONS.folders,
      ...folders,
      exclude: [...DEFAULT_OPTIONS.folders.exclude, ...(folders.exclude || [])],
    },
    files: {
      ...DEFAULT_OPTIONS.files,
      ...files,
      exclude: [...DEFAULT_OPTIONS.files.exclude, ...(files.exclude || [])],
    },
  };
}

/**
 * Read and parse an extension manifest from disk. Returns null when absent
 * or unparseable — a package with no manifest still gets a stable checksum.
 *
 * @param {string} dir - Extension directory
 * @returns {Promise<Object|null>}
 */
async function readManifestFile(dir) {
  try {
    const raw = await fs.promises.readFile(path.join(dir, MANIFEST_FILE), {
      encoding: 'utf8',
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Compute a SHA-256 checksum of an extension directory.
 *
 * The checksum combines two independent hashes:
 *  1. the tree of files *excluding* `package.json` (via `folder-hash`), and
 *  2. the manifest with its self-referential fields (`integrity`, `builtAt`)
 *     removed and its keys canonically ordered.
 *
 * Splitting them is what lets the publisher write the checksum *into* the
 * manifest it just hashed: the installer recomputes the same value from the
 * shipped directory. Every other manifest field — entry points, dependencies,
 * declared capabilities — is still covered, so tampering invalidates the hash.
 *
 * @param {string} dir - Absolute path to the extension directory
 * @param {Object} [options] - Override default hash options
 * @param {Object} [options.manifest] - Manifest to hash instead of the one on
 *   disk. Used at build time, where the manifest has not been written yet.
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 * @throws {TypeError} If dir is not a non-empty string
 */
export async function computeChecksum(dir, options = {}) {
  if (typeof dir !== 'string' || dir.trim() === '') {
    throw new TypeError('computeChecksum: dir must be a non-empty string');
  }

  const { manifest: manifestOverride, ...hashOptions } = options || {};

  let result;
  try {
    result = await hashElement(dir, mergeHashOptions(hashOptions));
  } catch (err) {
    throw new Error(
      `computeChecksum: failed to hash directory "${dir}": ${err.message}`,
    );
  }

  if (!result || !result.hash) {
    throw new Error(`computeChecksum: no hash returned for directory "${dir}"`);
  }

  const manifest =
    manifestOverride === undefined
      ? await readManifestFile(dir)
      : manifestOverride;

  return crypto
    .createHash('sha256')
    .update(`${CHECKSUM_PREFIX}\n${result.hash}\n${hashManifest(manifest)}`)
    .digest('hex');
}

/**
 * Verify an extension directory against an expected checksum.
 *
 * @param {string} extensionDir - Absolute path to the extension directory
 * @param {string} expectedChecksum - The trusted checksum from DB or manifest
 * @returns {Promise<{ valid: boolean, actual: string }>}
 */
export async function verifyExtensionChecksum(extensionDir, expectedChecksum) {
  const actual = await computeChecksum(extensionDir);
  return {
    valid: actual === expectedChecksum,
    actual,
  };
}
