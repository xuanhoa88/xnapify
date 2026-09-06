/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

/**
 * Bindings an extension may use without declaring anything.
 * Mirrors DEFAULT_EXTENSION_CAPABILITIES in shared/extension/utils/compat.js —
 * this module has to stay importable from the build task, which runs on plain
 * Node with no `@shared` alias.
 */
export const DEFAULT_CAPABILITIES = Object.freeze([
  'hook',
  'cache',
  'http',
  'template',
  'i18n',
]);

/** Bindings that are never granted, however they are declared. */
export const RESERVED_CAPABILITIES = Object.freeze(['extension', 'jwt', 'env']);

/** Source files worth scanning for container resolutions. */
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);

/** Directories that never hold first-party extension source. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

/**
 * `container.resolve('x')` / `container().resolve('x')` — the shape used by
 * lifecycle hooks, controllers and seeds.
 */
const CONTAINER_RESOLVE =
  /\bcontainer\s*(?:\(\s*\))?\s*\.resolve\(\s*(['"])([^'"]+)\1\s*\)/g;

/**
 * `req.app.get('container').resolve('x')` — the shape used inside route files.
 */
const APP_GET_RESOLVE =
  /\bget\(\s*(['"])container\1\s*\)\s*\.resolve\(\s*(['"])([^'"]+)\2\s*\)/g;

/**
 * Read the capabilities an extension manifest actually grants.
 *
 * A missing `capabilities` array falls back to the defaults; an explicit `[]`
 * grants nothing. Reserved bindings are stripped either way.
 *
 * @param {Object} manifest - Extension package.json
 * @returns {string[]}
 */
export function getDeclaredCapabilities(manifest) {
  const block =
    manifest && manifest.xnapify && typeof manifest.xnapify === 'object'
      ? manifest.xnapify
      : {};
  const declared = Array.isArray(block.capabilities)
    ? block.capabilities.filter(c => typeof c === 'string' && c.trim())
    : null;
  const capabilities = declared
    ? declared.map(c => c.trim())
    : [...DEFAULT_CAPABILITIES];
  return capabilities.filter(cap => !RESERVED_CAPABILITIES.includes(cap));
}

/**
 * True when `name` is covered by the granted capability list, honouring the
 * `*` wildcard and the `users:*` prefix form used by the scoped container.
 *
 * @param {string[]} granted
 * @param {string} name
 * @returns {boolean}
 */
export function isCapabilityGranted(granted, name) {
  return granted.some(cap => {
    if (cap === '*') return true;
    if (cap === name) return true;
    if (cap.endsWith('*')) return name.startsWith(cap.slice(0, -1));
    return false;
  });
}

/**
 * Collect every container binding a source file resolves by literal name.
 * Dynamic names (`container.resolve(binding)`) cannot be seen statically and
 * are simply not reported.
 *
 * @param {string} source - File contents
 * @returns {string[]} Binding names, in first-seen order
 */
export function findResolvedBindings(source) {
  const found = new Set();
  for (const [, , name] of source.matchAll(CONTAINER_RESOLVE)) {
    found.add(name);
  }
  for (const [, , , name] of source.matchAll(APP_GET_RESOLVE)) {
    found.add(name);
  }
  return [...found];
}

/**
 * Walk an extension directory and collect its literal `resolve()` calls.
 *
 * @param {string} dir - Extension root
 * @returns {Promise<Map<string, string[]>>} binding → relative file paths
 */
export async function collectResolvedBindings(dir) {
  const usage = new Map();

  const walk = async current => {
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;

      let source;
      try {
        source = await fs.promises.readFile(full, { encoding: 'utf8' });
      } catch {
        continue;
      }

      for (const name of findResolvedBindings(source)) {
        const relative = path.relative(dir, full);
        const files = usage.get(name);
        if (files) {
          if (!files.includes(relative)) files.push(relative);
        } else {
          usage.set(name, [relative]);
        }
      }
    }
  };

  await walk(dir);
  return usage;
}

/**
 * Audit one extension: every binding its source resolves by name must be
 * declared under `xnapify.capabilities` (or covered by the defaults).
 *
 * Undeclared bindings throw CapabilityDeniedError at runtime, so catching them
 * at package time turns a production crash into a build warning.
 *
 * @param {string} dir - Extension root directory
 * @param {Object} manifest - Extension package.json
 * @returns {Promise<{ name: string, granted: string[], undeclared: Array<{ capability: string, files: string[] }> }>}
 */
export async function auditExtensionCapabilities(dir, manifest) {
  const granted = getDeclaredCapabilities(manifest);
  const usage = await collectResolvedBindings(dir);

  const undeclared = [];
  for (const [capability, files] of usage) {
    if (!isCapabilityGranted(granted, capability)) {
      undeclared.push({ capability, files });
    }
  }

  return {
    name: (manifest && manifest.name) || path.basename(dir),
    granted,
    undeclared,
  };
}
