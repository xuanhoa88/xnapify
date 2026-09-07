/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'node:fs';

import { CorruptFileError, isMissingFsError, wrapFsError } from './errors.js';

/**
 * Ceiling for a whole-file read, in bytes.
 *
 * `readFileSync` materialises the entire file in memory. Everything read
 * through here is written by this repo — `.env`, the build manifest — so this
 * is a backstop against a pathological file rather than a defence against
 * untrusted input, and it is therefore a constant rather than an option.
 * 64 MB is far above any legitimate file the build reads.
 */
const MAX_BYTES = 64 * 1024 * 1024;

/**
 * Read a file, returning `fallback` when it does not exist.
 *
 * A missing file is routine — a fresh checkout with no `.env` yet, a first
 * build with no manifest — so it is a return value here rather than an
 * exception. Every *other* error still throws: an EACCES swallowed as
 * "missing" turns a misconfigured checkout into a silent, permanent default.
 *
 * The size check runs against the open descriptor rather than a separate
 * `stat`, so a file that grows between the two cannot slip past it.
 *
 * @param {string} filePath
 * @param {Object} [options]
 * @param {BufferEncoding|null} [options.encoding='utf8'] - null for a Buffer.
 * @param {*} [options.fallback=null] - Returned when the file is absent.
 * @returns {string|Buffer|*}
 */
export function readFileSafeSync(filePath, options = {}) {
  const { encoding = 'utf8', fallback = null } = options;

  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const stats = fs.fstatSync(fd);

    if (stats.isDirectory()) {
      throw wrapFsError(
        Object.assign(new Error('path is a directory'), { code: 'EISDIR' }),
        'readFileSafeSync',
        filePath,
      );
    }
    if (stats.size > MAX_BYTES) {
      throw new CorruptFileError(
        `Refusing to read ${filePath}: ${stats.size} bytes exceeds the ${MAX_BYTES} byte limit`,
        { code: 'EFBIG', path: filePath, operation: 'readFileSafeSync' },
      );
    }

    return fs.readFileSync(fd, encoding === null ? undefined : { encoding });
  } catch (error) {
    if (isMissingFsError(error)) return fallback;
    throw wrapFsError(error, 'readFileSafeSync', filePath);
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Already closed.
      }
    }
  }
}

/**
 * Read and parse a JSON file without letting a bad file kill the build.
 *
 * `JSON.parse` throws a `SyntaxError`, which carries no `err.code`, so an
 * `if (err.code === 'ENOENT')` guard does not catch it. An empty or truncated
 * file — the normal residue of a build killed partway through a non-atomic
 * write — would otherwise propagate as an unhandled rejection and, on Node 20+,
 * terminate the process.
 *
 * A zero-length file is treated as corrupt rather than missing on purpose: an
 * atomic write never publishes one, so its presence means something truncated
 * the file, and reporting that as "not there yet" hides the incident.
 *
 * @param {string} filePath
 * @param {Object} [options]
 * @param {*} [options.fallback=null] - Returned when the file is absent, and
 *   when it is corrupt under `onCorrupt: 'fallback'`.
 * @param {'throw'|'fallback'} [options.onCorrupt='throw'] - What an unparseable
 *   file does. `throw` is the default so that discarding data is always an
 *   explicit decision.
 * @param {(value: *) => boolean} [options.validate] - Reject a file that parses
 *   but is not the expected shape (e.g. `null`, or an object missing a key).
 *   A failed check is handled exactly like a parse failure.
 * @returns {*}
 */
export function readJsonSafeSync(filePath, options = {}) {
  const { fallback = null, onCorrupt = 'throw', validate } = options;

  const raw = readFileSafeSync(filePath, {
    encoding: 'utf8',
    fallback: null,
  });
  if (raw === null) return fallback;

  const handleCorrupt = reason => {
    if (onCorrupt === 'throw') {
      throw new CorruptFileError(`${filePath} is not valid JSON: ${reason}`, {
        path: filePath,
        operation: 'readJsonSafeSync',
        raw: raw.slice(0, 512),
      });
    }
    return fallback;
  };

  if (raw.trim().length === 0) return handleCorrupt('file is empty');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return handleCorrupt(error.message);
  }

  if (validate && !validate(parsed)) return handleCorrupt('failed validation');

  return parsed;
}
