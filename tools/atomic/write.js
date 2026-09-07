/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { AtomicFileError, isTransientFsError, wrapFsError } from './errors.js';

const IS_WINDOWS = process.platform === 'win32';

/**
 * How many times a rename is retried, and how long between attempts.
 *
 * Only Windows needs this (see TRANSIENT_CODES); on POSIX the first failure is
 * the real answer and retrying just delays it.
 */
const RETRIES = IS_WINDOWS ? 10 : 0;
const RETRY_BASE_MS = 10;

let tempCounter = 0;

/**
 * A temp-file suffix that no other writer can produce.
 *
 * `Date.now()` is not enough: it repeats for every write inside the same
 * millisecond, so two writers to the same key hand each other a half-written
 * file and rename the winner's truncated bytes into place. The pid separates
 * processes, the counter separates concurrent writes inside one process, and
 * the random bytes separate a recycled pid after a restart.
 *
 * @returns {string}
 */
export function tempSuffix() {
  tempCounter = (tempCounter + 1) >>> 0;
  return `.${process.pid.toString(36)}-${tempCounter.toString(36)}-${crypto
    .randomBytes(4)
    .toString('hex')}.tmp`;
}

// ======================================================================
// Crash-time temp cleanup
// ======================================================================

/**
 * Temp files that exist right now. A build that is Ctrl-C'd between `open` and
 * `rename` would otherwise leave one behind forever, and a directory that only
 * ever grows eventually exhausts inodes on the volume.
 *
 * `exit` is the only hook used: it is the one event that fires for both a
 * normal exit and the default handling of an uncaught exception, and it does
 * not change the process's termination behaviour the way installing a SIGINT
 * handler would.
 *
 * This is the only temp reaper in the build toolchain — the runtime's
 * background `sweepTemps` has no counterpart here, because a build process is
 * short-lived and has no idle moment in which to run one.
 */
const pendingTemps = new Set();
let exitHookInstalled = false;

function trackTemp(tmpPath) {
  if (!exitHookInstalled && typeof process?.once === 'function') {
    exitHookInstalled = true;
    process.once('exit', () => {
      for (const leftover of pendingTemps) {
        try {
          fs.unlinkSync(leftover);
        } catch {
          // Exiting anyway.
        }
      }
    });
  }
  pendingTemps.add(tmpPath);
}

function untrackTemp(tmpPath) {
  pendingTemps.delete(tmpPath);
}

// ======================================================================
// Retry helpers
// ======================================================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Block the thread for `ms`. Used only by the *Sync variant, which exists for
 * `preboot`, where there is no event loop turn left to await.
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function withFsRetry(fn, { operation, filePath }) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= RETRIES || !isTransientFsError(error)) {
        throw wrapFsError(error, operation, filePath);
      }
      await sleep(RETRY_BASE_MS * (attempt + 1));
    }
  }
}

function withFsRetrySync(fn, { operation, filePath }) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return fn();
    } catch (error) {
      if (attempt >= RETRIES || !isTransientFsError(error)) {
        throw wrapFsError(error, operation, filePath);
      }
      sleepSync(RETRY_BASE_MS * (attempt + 1));
    }
  }
}

// ======================================================================
// Directory helpers
// ======================================================================

/**
 * Create `dirPath` and its parents.
 *
 * `recursive: true` already tolerates the directory existing, which is what
 * makes it safe for parallel build tasks to create the same output directory
 * at once. It does *not* tolerate the path existing as a file, and the raw
 * EEXIST that produces names only the errno, so that case is re-raised with
 * the path in the message.
 *
 * @param {string} dirPath
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
  try {
    await fsp.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code === 'EEXIST' || error.code === 'ENOTDIR') {
      throw new AtomicFileError(
        `Cannot create directory ${dirPath}: a file already exists at that path`,
        {
          code: error.code,
          path: dirPath,
          operation: 'ensureDir',
          cause: error,
        },
      );
    }
    throw wrapFsError(error, 'ensureDir', dirPath);
  }
}

/** Sync variant of {@link ensureDir}. Internal: only writeFileAtomicSync needs it. */
function ensureDirSync(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (error) {
    if (error.code === 'EEXIST' || error.code === 'ENOTDIR') {
      throw new AtomicFileError(
        `Cannot create directory ${dirPath}: a file already exists at that path`,
        {
          code: error.code,
          path: dirPath,
          operation: 'ensureDirSync',
          cause: error,
        },
      );
    }
    throw wrapFsError(error, 'ensureDirSync', dirPath);
  }
}

/**
 * Flush a directory entry so a rename into it survives a host crash.
 *
 * `rename` is atomic with respect to *readers* the moment it returns, which is
 * all a process crash can observe. A power cut is different: the new file's
 * contents can reach the platter while the directory entry naming it does not.
 * Only fsyncing the directory orders those two.
 *
 * Kept in a build-time module because the two files written through here —
 * `.env` and the JWT secret inside it — are the developer's only copy, not a
 * regenerable build artifact.
 *
 * Best-effort by design — Windows cannot open a directory as a file at all, and
 * some network filesystems refuse the sync. The contents were already flushed,
 * so the remaining exposure is a lost rename, not a corrupt file.
 *
 * @param {string} dirPath
 * @returns {Promise<void>}
 */
async function fsyncDir(dirPath) {
  if (IS_WINDOWS) return;
  let handle = null;
  try {
    handle = await fsp.open(dirPath, 'r');
    await handle.sync();
  } catch {
    // Unsupported here — nothing else to do.
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

/** Sync variant of {@link fsyncDir}. */
function fsyncDirSync(dirPath) {
  if (IS_WINDOWS) return;
  let fd = null;
  try {
    fd = fs.openSync(dirPath, 'r');
    fs.fsyncSync(fd);
  } catch {
    // Unsupported here — nothing else to do.
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

// ======================================================================
// Mode inheritance
// ======================================================================

/**
 * The permission bits a replacement file must be given.
 *
 * A temp file is created fresh, so it gets the process umask — typically 0644.
 * Renaming it over a 0600 file therefore *widens* that file's permissions
 * without anyone asking. That is not hypothetical here: `preboot` rewrites
 * `.env` with no `mode` of its own and relies entirely on this to keep the
 * file — which holds `XNAPIFY_KEY` — owner-only. A 0644 signing secret is
 * readable by every account on the host.
 *
 * Returns undefined when the target does not exist yet, so a genuinely new file
 * still gets normal umask treatment.
 */
async function inheritMode(target) {
  try {
    const stats = await fsp.stat(target);
    return stats.mode & 0o7777;
  } catch {
    return undefined;
  }
}

function inheritModeSync(target) {
  try {
    return fs.statSync(target).mode & 0o7777;
  } catch {
    return undefined;
  }
}

// ======================================================================
// Atomic write
// ======================================================================

/**
 * Replace `filePath` with `data` such that a reader sees either the old file or
 * the new one, never a mixture and never a truncated file.
 *
 * The sequence is write-temp → fsync(temp) → chmod → rename → fsync(dir).
 * Dropping any step costs a specific guarantee:
 *
 *   - no temp file      → a reader can observe a partial write, and a crash
 *                         leaves the file truncated rather than unchanged
 *   - no fsync(temp)    → a power cut can publish a file whose contents never
 *                         reached the disk (rename is ordered, writes are not)
 *   - no fsync(dir)     → a power cut can lose the rename itself
 *   - no chmod          → replacing a 0600 file silently publishes it as 0644
 *
 * The temp is always created in the *same directory* as the target. Putting it
 * in `os.tmpdir()` would be a cross-device rename (EXDEV) on any host where
 * /tmp is a separate mount — which is most containers.
 *
 * @param {string} filePath - Target path. Replaced, not appended to.
 * @param {string|Buffer|Uint8Array} data
 * @param {Object} [options]
 * @param {BufferEncoding} [options.encoding='utf8'] - Ignored for Buffer data.
 * @param {number} [options.mode] - Force permission bits instead of inheriting
 *   the target's. Use for files that must be created restricted (0o600).
 * @returns {Promise<void>}
 */
export async function writeFileAtomic(filePath, data, options = {}) {
  const { encoding = 'utf8', mode } = options;

  const target = path.resolve(filePath);
  const dir = path.dirname(target);

  await ensureDir(dir);

  const finalMode = mode ?? (await inheritMode(target));
  const tmpPath = target + tempSuffix();
  trackTemp(tmpPath);

  try {
    let handle = null;
    try {
      // 'wx' fails rather than truncates if the temp name somehow exists, so a
      // suffix collision surfaces as EEXIST instead of two writers sharing a fd.
      handle = await fsp.open(tmpPath, 'wx', finalMode ?? 0o666);
      await handle.writeFile(data, encoding);
      await handle.sync();
      // chmod after creation because open()'s mode argument is filtered by the
      // process umask, so it cannot reproduce 0600 on a umask-022 host.
      if (finalMode !== undefined) await handle.chmod(finalMode);
    } finally {
      if (handle) await handle.close();
    }

    await withFsRetry(() => fsp.rename(tmpPath, target), {
      operation: 'writeFileAtomic:rename',
      filePath: target,
    });
    untrackTemp(tmpPath);

    await fsyncDir(dir);
  } catch (error) {
    // Clean up on *any* failure, not just a failed rename: a write that dies on
    // ENOSPC leaves a temp behind too, and that is exactly when the volume can
    // least afford it.
    await fsp.unlink(tmpPath).catch(() => {});
    untrackTemp(tmpPath);
    throw wrapFsError(error, 'writeFileAtomic', target);
  }
}

/**
 * Sync variant of {@link writeFileAtomic}.
 *
 * Exists for `tools/npm/preboot.js`, which rewrites `.env` from a top-level
 * synchronous path. Prefer the async form everywhere else — each fsync here
 * blocks the event loop.
 *
 * @param {string} filePath
 * @param {string|Buffer|Uint8Array} data
 * @param {Object} [options] - Same shape as {@link writeFileAtomic}.
 * @returns {void}
 */
export function writeFileAtomicSync(filePath, data, options = {}) {
  const { encoding = 'utf8', mode } = options;

  const target = path.resolve(filePath);
  const dir = path.dirname(target);

  ensureDirSync(dir);

  const finalMode = mode ?? inheritModeSync(target);
  const tmpPath = target + tempSuffix();
  trackTemp(tmpPath);

  try {
    const fd = fs.openSync(tmpPath, 'wx', finalMode ?? 0o666);
    try {
      fs.writeFileSync(fd, data, encoding);
      fs.fsyncSync(fd);
      if (finalMode !== undefined) fs.fchmodSync(fd, finalMode);
    } finally {
      fs.closeSync(fd);
    }

    withFsRetrySync(() => fs.renameSync(tmpPath, target), {
      operation: 'writeFileAtomicSync:rename',
      filePath: target,
    });
    untrackTemp(tmpPath);

    fsyncDirSync(dir);
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Already gone.
    }
    untrackTemp(tmpPath);
    throw wrapFsError(error, 'writeFileAtomicSync', target);
  }
}

/**
 * Serialise `value` and write it atomically.
 *
 * A torn JSON file is the single most common way a filesystem defect becomes a
 * process crash — `JSON.parse` throws a SyntaxError that no `err.code` check
 * catches. Pairing this with {@link readJsonSafeSync} closes that loop for the
 * build manifest, which the next build reads back.
 *
 * @param {string} filePath
 * @param {unknown} value
 * @param {Object} [options] - {@link writeFileAtomic} options plus `spaces`.
 * @param {number} [options.spaces=0] - Indentation. Use 2 for files a human reads.
 * @returns {void}
 */
export function writeJsonAtomicSync(filePath, value, options = {}) {
  const { spaces = 0, ...rest } = options;
  const json = JSON.stringify(value, null, spaces);
  if (json === undefined) {
    throw new AtomicFileError(
      `Refusing to write ${filePath}: value is not JSON-serialisable`,
      { path: filePath, operation: 'writeJsonAtomicSync' },
    );
  }
  // Trailing newline so the file is a well-formed text file and a truncated
  // write is detectable by its absence.
  writeFileAtomicSync(filePath, `${json}\n`, rest);
}
