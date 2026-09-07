/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { withFileLock } from './lock.js';
import { readJsonSafe } from './read.js';
import { writeJsonAtomic } from './write.js';

/**
 * A sentinel a mutator returns to mean "nothing changed, skip the write".
 * Cheaper than writing identical bytes, and it avoids bumping mtime, which some
 * callers use as a change signal.
 */
export const NO_CHANGE = Symbol('atomic.NO_CHANGE');

/**
 * Read a JSON file, transform it, and write it back — atomically, and safely
 * against other processes doing the same thing.
 *
 * Atomic *writes* alone do not make read-modify-write safe. Two workers that
 * both read `{a: 1}`, each add their own key, and each write atomically produce
 * two perfectly-formed files, one of which silently loses the other's change.
 * That lost-update race is why this takes a lock across the whole cycle rather
 * than only around the write, and it is the pattern every `.env` writer,
 * manifest writer, and checksum-registry writer in this repo actually needs.
 *
 * The mutator may be called only once, so it must not be relied on for retries.
 *
 * @template T
 * @param {string} filePath
 * @param {(current: T) => T | typeof NO_CHANGE | Promise<T | typeof NO_CHANGE>} mutator
 * @param {Object} [options]
 * @param {T} [options.fallback] - Value handed to `mutator` when the file does
 *   not exist yet. Defaults to `{}`.
 * @param {string} [options.lockPath] - Defaults to `<filePath>.lock`.
 * @param {'throw'|'fallback'|'quarantine'} [options.onCorrupt='throw']
 * @param {number} [options.spaces=2] - These files are usually human-inspected.
 * @param {boolean} [options.durable=true]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.staleMs]
 * @returns {Promise<T>} The value that was written, or the current value when
 *   the mutator returned {@link NO_CHANGE}.
 */
export async function updateJsonAtomic(filePath, mutator, options = {}) {
  const {
    fallback = {},
    lockPath = `${filePath}.lock`,
    onCorrupt = 'throw',
    spaces = 2,
    durable = true,
    quarantineDir,
    validate,
    ...lockOptions
  } = options;

  return withFileLock(
    lockPath,
    async signal => {
      const current = await readJsonSafe(filePath, {
        fallback,
        onCorrupt,
        quarantineDir,
        validate,
      });

      const next = await mutator(current);
      if (next === NO_CHANGE) return current;

      // Re-check before writing: if the lock was stolen while the mutator ran,
      // whatever it computed was based on a snapshot another process has since
      // replaced, and writing it would clobber their work.
      signal.throwIfAborted();

      await writeJsonAtomic(filePath, next, { spaces, durable });
      return next;
    },
    lockOptions,
  );
}
