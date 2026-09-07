/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Crash-safe filesystem primitives shared by every file-backed store.
 *
 * See ./README.md for the guarantees each function provides, which of them the
 * hand-rolled implementations this replaced were missing, and how to choose
 * between `durable: true` and `false`.
 *
 * Deliberately depends on nothing but `node:` builtins — no `@shared` alias, no
 * container, no logger — so that build scripts under `tools/`, which run under
 * raw Node with no bundler, can import it by relative path exactly as the
 * bundled runtime imports it by alias.
 */

export {
  AtomicFileError,
  CorruptFileError,
  LockLostError,
  LockTimeoutError,
  MISSING_CODES,
  TRANSIENT_CODES,
  isMissingFsError,
  isTransientFsError,
  wrapFsError,
} from './errors.js';

export {
  TEMP_SUFFIX_PATTERN,
  ensureDir,
  ensureDirSync,
  fsyncDir,
  fsyncDirSync,
  tempSuffix,
  writeFileAtomic,
  writeFileAtomicSync,
  writeJsonAtomic,
  writeJsonAtomicSync,
} from './write.js';

export {
  pathExists,
  readFileSafe,
  readFileSafeSync,
  readJsonSafe,
  readJsonSafeSync,
} from './read.js';

export { LockHandle, acquireFileLock, withFileLock } from './lock.js';

export { NO_CHANGE, updateJsonAtomic } from './update.js';

export { sweepTemps } from './sweep.js';

export {
  PathEscapeError,
  resolveWithin,
  resolveWithinReal,
  safeSegment,
} from './paths.js';

export { DEFAULT_CONCURRENCY, mapLimit } from './concurrency.js';
