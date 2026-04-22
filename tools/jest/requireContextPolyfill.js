/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
    if (filename === __filename) continue;
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

// ─── require.context polyfill ─────────────────────────────────────────────────

/**
 * Polyfill for Webpack's require.context, for use in Jest + SWC environments.
 *
 * @param {string}  directory         - Directory to scan (absolute or relative).
 * @param {boolean} useSubdirectories - Whether to recurse into subdirectories.
 * @param {RegExp}  regExp            - Filter applied to relative module keys.
 * @param {string}  _mode             - Webpack API compat parameter (ignored).
 * @returns {Function} A context function with .keys(), .resolve(), and .id.
 */
function requireContext(
  directory,
  useSubdirectories = false,
  regExp = /^\.\/.*$/,
  _mode = 'sync',
) {
  const absoluteBase = resolveContextDirectory(directory);

  function scanDir(dir) {
    if (!fs.existsSync(dir)) {
      console.warn('[require.context] Directory not found: ' + dir);
      return [];
    }

    return fs.readdirSync(dir).flatMap(function (file) {
      const absPath = path.join(dir, file);

      if (fs.statSync(absPath).isDirectory()) {
        return useSubdirectories ? scanDir(absPath) : [];
      }

      const relKey = toRelativeKey(absoluteBase, absPath);
      return regExp.test(relKey) ? [absPath] : [];
    });
  }

  const files = scanDir(absoluteBase);

  // `this` is the caller's require function (the Jest sandbox's wrapped require).
  // We use it so that Jest's mocks and transforms (like SWC) apply correctly.
  const sandboxRequire = typeof this === 'function' ? this : require;

  const context = function (key) {
    return sandboxRequire(path.resolve(absoluteBase, key));
  };
  context.keys = function () {
    return files.map(function (f) {
      return toRelativeKey(absoluteBase, f);
    });
  };
  context.resolve = function (key) {
    return path.resolve(absoluteBase, key);
  };
  context.id = directory;

  return context;
}

module.exports = requireContext;
