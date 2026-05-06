/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * ESM-safe reference to the current file's absolute path.
 * Replaces the CJS `__filename` global which is undefined under native ESM.
 */
const SELF_FILENAME = fileURLToPath(import.meta.url);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert an absolute path to a require.context-style relative key.
 * e.g. /abs/base/foo/bar.js → ./foo/bar.js
 */
function toRelativeKey(absoluteBase, absPath) {
  return './' + path.relative(absoluteBase, absPath).replace(/\\/g, '/');
}

/**
 * Resolve the originating module filename from the current stack trace.
 * Allows relative require.context paths (e.g. './translations') to resolve
 * relative to the caller module, matching Webpack's behavior.
 *
 * Skips frames originating from this polyfill file itself and from
 * node_modules (internal Jest/SWC runtime frames).
 */
function resolveCallerFilename() {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const { stack } = new Error();
  Error.prepareStackTrace = originalPrepareStackTrace;

  if (!Array.isArray(stack) || stack.length === 0) return null;

  for (const frame of stack) {
    if (!frame || typeof frame.getFileName !== 'function') continue;

    const filename = frame.getFileName();
    if (!filename) continue;
    if (filename === SELF_FILENAME) continue;
    if (filename.includes('/node_modules/')) continue;

    return filename;
  }

  return null;
}

/**
 * Resolve the absolute base directory for a require.context call.
 * Supports absolute paths, caller-relative paths, and cwd-relative fallback.
 */
function resolveContextDirectory(directory) {
  if (path.isAbsolute(directory)) return path.resolve(directory);

  const caller = resolveCallerFilename();
  if (caller) return path.resolve(path.dirname(caller), directory);

  return path.resolve(process.cwd(), directory);
}

/**
 * Recursively scan a directory for files matching a regex filter.
 * Returns an array of absolute paths.
 *
 * @param {string}  dir              - Directory to scan
 * @param {string}  absoluteBase     - Root base for relative key computation
 * @param {RegExp}  regExp           - Filter applied to relative keys
 * @param {boolean} useSubdirectories - Whether to recurse into subdirectories
 * @returns {string[]} Matching absolute file paths
 */
function scanDir(dir, absoluteBase, regExp, useSubdirectories) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('[require.context] Directory not found: ' + dir);
    }
    return [];
  }

  const results = [];

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (useSubdirectories) {
        results.push(...scanDir(absPath, absoluteBase, regExp, true));
      }
    } else if (entry.isFile()) {
      const relKey = toRelativeKey(absoluteBase, absPath);
      if (regExp.test(relKey)) {
        results.push(absPath);
      }
    }
  }

  return results;
}

// ─── require.context polyfill ─────────────────────────────────────────────────

/**
 * Polyfill for Webpack's require.context, for use in Jest + SWC environments.
 * Supports both standard require.context positional args AND import.meta.webpackContext options objects!
 *
 * @param {string}  directory         - Directory to scan (absolute or relative).
 * @param {boolean|object} useSubdirectoriesOrOptions - Whether to recurse into subdirectories, OR options object.
 * @param {RegExp}  regExp            - Filter applied to relative module keys.
 * @param {string}  _mode             - Webpack API compat parameter (ignored).
 * @returns {Function} A context function with .keys(), .resolve(), and .id.
 */
function requireContext(
  directory,
  useSubdirectoriesOrOptions = false,
  regExp = /^\.\/.*$/,
  _mode = 'sync',
) {
  let useSubdirectories = false;
  let actualRegExp = /^\.\/.*$/;

  // Handle import.meta.webpackContext signature: require.context(dir, { recursive: true, regExp: /.../ })
  if (typeof useSubdirectoriesOrOptions === 'object' && useSubdirectoriesOrOptions !== null && !(useSubdirectoriesOrOptions instanceof RegExp)) {
    useSubdirectories = useSubdirectoriesOrOptions.recursive !== undefined ? useSubdirectoriesOrOptions.recursive : true;
    if (useSubdirectoriesOrOptions.regExp !== undefined) {
      actualRegExp = useSubdirectoriesOrOptions.regExp;
    }
  } else {
    // Handle standard require.context signature: require.context(dir, true, /.../)
    useSubdirectories = !!useSubdirectoriesOrOptions;
    actualRegExp = regExp;
  }

  const absoluteBase = resolveContextDirectory(directory);
  const files = scanDir(absoluteBase, absoluteBase, actualRegExp, useSubdirectories);

  // Pre-compute relative keys once (avoids recomputing on every .keys() call)
  const relativeKeys = files.map(f => toRelativeKey(absoluteBase, f));

  // Build a fast lookup map: relativeKey → absolutePath
  const keyToAbsPath = new Map();
  for (let i = 0; i < files.length; i++) {
    keyToAbsPath.set(relativeKeys[i], files[i]);
  }

  // `this` is the caller's require function (the Jest sandbox's wrapped require).
  // We use it so that Jest's mocks and transforms (like SWC) apply correctly.
  const sandboxRequire = typeof this === 'function' ? this : require;

  /**
   * Load a module by its relative key.
   * @param {string} key - Relative key (e.g. './foo/bar.js')
   * @returns {*} The loaded module
   */
  const context = function (key) {
    // Prefer the pre-resolved absolute path for O(1) lookup
    const resolved = keyToAbsPath.get(key);
    return sandboxRequire(resolved || path.resolve(absoluteBase, key));
  };

  context.keys = function () {
    return relativeKeys;
  };

  context.resolve = function (key) {
    return keyToAbsPath.get(key) || path.resolve(absoluteBase, key);
  };

  context.id = directory;

  return context;
}

export default requireContext;
