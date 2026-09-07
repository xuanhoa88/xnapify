/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { CorruptFileError, isMissingFsError, wrapFsError } from './errors.js';
import { ensureDir, writeFileAtomic } from './write.js';

/**
 * Ceiling for a whole-file read, in bytes.
 *
 * `readFile` materialises the entire file in memory. Anywhere the file's size
 * is influenced by a user (an upload, a downloaded extension package, a cache
 * entry keyed on a request) that is an unbounded allocation, and the failure
 * mode is the process being OOM-killed rather than a handled error. 64 MB is
 * far above any legitimate JSON this app writes.
 */
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function pathExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file, returning `fallback` when it does not exist.
 *
 * A missing file is routine — a fresh install, a cache miss, a queue that has
 * not been written to yet — so it is a return value here rather than an
 * exception. Every *other* error still throws: an EACCES swallowed as "missing"
 * turns a misconfigured deployment into a silent, permanent cache miss.
 *
 * The size check runs against the open handle rather than a separate `stat`, so
 * a file that grows between the two cannot slip past it.
 *
 * @param {string} filePath
 * @param {Object} [options]
 * @param {BufferEncoding|null} [options.encoding='utf8'] - null for a Buffer.
 * @param {*} [options.fallback=null] - Returned when the file is absent.
 * @param {number} [options.maxBytes=67108864] - Refuse files larger than this.
 * @returns {Promise<string|Buffer|*>}
 */
export async function readFileSafe(filePath, options = {}) {
  const {
    encoding = 'utf8',
    fallback = null,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options;

  let handle = null;
  try {
    handle = await fsp.open(filePath, 'r');
    const stats = await handle.stat();

    if (stats.isDirectory()) {
      throw wrapFsError(
        Object.assign(new Error('path is a directory'), { code: 'EISDIR' }),
        'readFileSafe',
        filePath,
      );
    }
    // The maxBytes ceiling below is enforced against stat().size, and every
    // non-regular file reports 0: a FIFO, a socket, a character device. The
    // limit passes and the unbounded read that follows never ends — reading a
    // symlink to /dev/zero allocates until the process is killed. Anything
    // taking its path from configuration, a manifest or a request is one
    // symlink away from being an OOM.
    if (!stats.isFile()) {
      throw wrapFsError(
        Object.assign(new Error('path is not a regular file'), {
          code: 'EINVAL',
        }),
        'readFileSafe',
        filePath,
      );
    }
    if (stats.size > maxBytes) {
      throw new CorruptFileError(
        `Refusing to read ${filePath}: ${stats.size} bytes exceeds the ${maxBytes} byte limit`,
        { code: 'EFBIG', path: filePath, operation: 'readFileSafe' },
      );
    }

    return await handle.readFile(encoding === null ? undefined : { encoding });
  } catch (error) {
    if (isMissingFsError(error)) return fallback;
    throw wrapFsError(error, 'readFileSafe', filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

/** Sync variant of {@link readFileSafe}. */
export function readFileSafeSync(filePath, options = {}) {
  const {
    encoding = 'utf8',
    fallback = null,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options;

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
    // The maxBytes ceiling below is enforced against stat().size, and every
    // non-regular file reports 0: a FIFO, a socket, a character device. The
    // limit passes and the unbounded read that follows never ends — reading a
    // symlink to /dev/zero allocates until the process is killed. Anything
    // taking its path from configuration, a manifest or a request is one
    // symlink away from being an OOM.
    if (!stats.isFile()) {
      throw wrapFsError(
        Object.assign(new Error('path is not a regular file'), {
          code: 'EINVAL',
        }),
        'readFileSafeSync',
        filePath,
      );
    }
    if (stats.size > maxBytes) {
      throw new CorruptFileError(
        `Refusing to read ${filePath}: ${stats.size} bytes exceeds the ${maxBytes} byte limit`,
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
 * Move an unreadable file aside instead of deleting it.
 *
 * A torn write and genuine garbage are indistinguishable from the outside, and
 * the torn one may be the only copy of real work (a queued job, a user's flow).
 * Deleting it destroys evidence at exactly the moment an operator needs it.
 */
async function quarantine(filePath, quarantineDir) {
  const dir = quarantineDir ?? path.join(path.dirname(filePath), 'corrupt');
  await ensureDir(dir);
  const dest = path.join(
    dir,
    `${path.basename(filePath)}.${Date.now()}.corrupt`,
  );
  try {
    await fsp.rename(filePath, dest);
    return dest;
  } catch (error) {
    if (error.code === 'EXDEV') {
      // `corrupt/` landed on another mount — copy then remove rather than
      // leaving the bad file in place to be re-read on the next boot.
      const raw = await fsp.readFile(filePath);
      await writeFileAtomic(dest, raw, { encoding: null });
      await fsp.unlink(filePath).catch(() => {});
      return dest;
    }
    throw wrapFsError(error, 'quarantine', filePath);
  }
}

/**
 * Read and parse a JSON file without letting a bad file kill the process.
 *
 * `JSON.parse` throws a `SyntaxError`, which carries no `err.code`, so the
 * `if (err.code === 'ENOENT')` guard that every adapter in this repo has does
 * not catch it. An empty or truncated file — the normal residue of a crash
 * partway through a non-atomic write — therefore propagates as an unhandled
 * rejection and, on Node 20+, terminates the process.
 *
 * A zero-length file is treated as corrupt rather than missing on purpose: an
 * atomic write never publishes one, so its presence means something truncated
 * the file, and reporting that as "not there yet" hides the incident.
 *
 * @param {string} filePath
 * @param {Object} [options]
 * @param {*} [options.fallback=null] - Returned when the file is absent, and
 *   when it is corrupt under `onCorrupt: 'fallback'`.
 * @param {'throw'|'fallback'|'quarantine'} [options.onCorrupt='throw'] - What
 *   an unparseable file does. `throw` is the default so that discarding data is
 *   always an explicit decision. `quarantine` moves it aside and returns
 *   `fallback`.
 * @param {string} [options.quarantineDir] - Defaults to `<dir>/corrupt`.
 * @param {(value: *) => boolean} [options.validate] - Reject a file that parses
 *   but is not the expected shape (e.g. `null`, or an object missing a key).
 *   A failed check is handled exactly like a parse failure.
 * @param {number} [options.maxBytes]
 * @param {(key: string, value: *) => *} [options.reviver]
 * @returns {Promise<*>}
 */
export async function readJsonSafe(filePath, options = {}) {
  const {
    fallback = null,
    onCorrupt = 'throw',
    quarantineDir,
    validate,
    maxBytes,
    reviver,
  } = options;

  const raw = await readFileSafe(filePath, {
    encoding: 'utf8',
    fallback: null,
    maxBytes,
  });
  if (raw === null) return fallback;

  const handleCorrupt = async reason => {
    if (onCorrupt === 'fallback') return fallback;
    if (onCorrupt === 'quarantine') {
      const quarantinedTo = await quarantine(filePath, quarantineDir);
      // Deliberately loud: silent recovery from corruption is how a store that
      // is losing data every night looks healthy for a year.
      console.error(
        `[atomic] ${filePath} was unreadable (${reason}); moved to ${quarantinedTo}`,
      );
      return fallback;
    }
    throw new CorruptFileError(`${filePath} is not valid JSON: ${reason}`, {
      path: filePath,
      operation: 'readJsonSafe',
      raw: raw.slice(0, 512),
    });
  };

  if (raw.trim().length === 0) return handleCorrupt('file is empty');

  let parsed;
  try {
    parsed = JSON.parse(raw, reviver);
  } catch (error) {
    return handleCorrupt(error.message);
  }

  if (validate && !validate(parsed)) return handleCorrupt('failed validation');

  return parsed;
}

/** Sync variant of {@link readJsonSafe}. Does not support `quarantine`. */
export function readJsonSafeSync(filePath, options = {}) {
  const {
    fallback = null,
    onCorrupt = 'throw',
    validate,
    maxBytes,
    reviver,
  } = options;

  const raw = readFileSafeSync(filePath, {
    encoding: 'utf8',
    fallback: null,
    maxBytes,
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
    parsed = JSON.parse(raw, reviver);
  } catch (error) {
    return handleCorrupt(error.message);
  }

  if (validate && !validate(parsed)) return handleCorrupt('failed validation');

  return parsed;
}
