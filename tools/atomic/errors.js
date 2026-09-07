/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Error taxonomy for atomic filesystem operations.
 *
 * Callers need to tell three situations apart, because each has a different
 * correct response:
 *
 *   - the file is *gone*        → recreate it, or fall back to a default
 *   - the file is *unreadable*  → quarantine and alert; never silently discard
 *   - the store is *unavailable*→ back off and retry; do not report as data loss
 *
 * Collapsing them is how a full disk gets reported as "cache miss" and how a
 * torn write gets reported as "empty config".
 */

const IS_WINDOWS = process.platform === 'win32';

/**
 * Base class for every error this module raises. Always carries the `path` and
 * the `operation` so a log line identifies the file without the caller having
 * to re-thread that context.
 */
export class AtomicFileError extends Error {
  /**
   * @param {string} message
   * @param {Object} [details]
   * @param {string} [details.code] - errno-style code (ENOSPC, EACCES, ...)
   * @param {string} [details.path] - the file the operation targeted
   * @param {string} [details.operation] - e.g. 'writeFileAtomic'
   * @param {Error} [details.cause] - the underlying error, preserved
   */
  constructor(message, { code, path: filePath, operation, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AtomicFileError';
    this.code = code;
    this.path = filePath;
    this.operation = operation;
  }
}

/** A lock could not be acquired within the allotted time. Retry or shed load. */
export class LockTimeoutError extends AtomicFileError {
  constructor(message, details) {
    super(message, details);
    this.name = 'LockTimeoutError';
  }
}

/**
 * The lock was held but is no longer ours — another process judged it stale and
 * stole it. Anything written under it after this point may race, so the holder
 * must abort rather than finish its critical section.
 */
export class LockLostError extends AtomicFileError {
  constructor(message, details) {
    super(message, details);
    this.name = 'LockLostError';
  }
}

/**
 * The file exists but could not be interpreted — the normal outcome of a host
 * crash partway through a non-atomic write.
 *
 * Distinct from "missing" on purpose: a missing config is a fresh install, a
 * corrupt one is an incident. `raw` carries what was actually on disk so an
 * operator can see it without racing the next write.
 */
export class CorruptFileError extends AtomicFileError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'CorruptFileError';
    this.raw = details.raw;
    this.quarantinedTo = details.quarantinedTo;
  }
}

/**
 * Codes worth retrying rather than surfacing.
 *
 * On Windows a virus scanner or the search indexer holds a transient handle on
 * a file it just saw created, so `rename` and `unlink` fail with EPERM/EACCES/
 * EBUSY for a few milliseconds. On POSIX those same codes mean the permissions
 * are genuinely wrong and retrying only delays a real error, so the platform
 * decides membership rather than a shared list.
 */
export const TRANSIENT_CODES = new Set(
  IS_WINDOWS
    ? ['EBUSY', 'EMFILE', 'ENFILE', 'EAGAIN', 'EPERM', 'EACCES', 'EEXIST']
    : ['EBUSY', 'EMFILE', 'ENFILE', 'EAGAIN'],
);

/**
 * Codes that mean "the file is not there", which is routine rather than a fault.
 */
export const MISSING_CODES = new Set(['ENOENT', 'ENOTDIR']);

/**
 * @param {unknown} error
 * @returns {boolean} Whether retrying the same operation could plausibly work.
 */
export function isTransientFsError(error) {
  return Boolean(error && TRANSIENT_CODES.has(error.code));
}

/**
 * @param {unknown} error
 * @returns {boolean} Whether the error means the path does not exist.
 */
export function isMissingFsError(error) {
  return Boolean(error && MISSING_CODES.has(error.code));
}

/**
 * Wrap a raw fs error, keeping its errno code so existing `err.code === 'ENOENT'`
 * checks in calling code keep working after a migration to this module.
 *
 * @param {Error} error
 * @param {string} operation
 * @param {string} filePath
 * @returns {AtomicFileError}
 */
export function wrapFsError(error, operation, filePath) {
  if (error instanceof AtomicFileError) return error;
  return new AtomicFileError(
    `${operation} failed for ${filePath}: ${error.message}`,
    {
      code: error.code,
      path: filePath,
      operation,
      cause: error,
    },
  );
}
