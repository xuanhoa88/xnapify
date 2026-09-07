/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';

import { mapLimit } from './concurrency.js';
import { isMissingFsError } from './errors.js';

/**
 * Artifacts a crashed writer can leave behind, matched by the *full* shape
 * `tempSuffix()` produces — `<pid>-<counter>-<8 hex>.tmp`, optionally with the
 * `.stale` a dying lock steal appends.
 *
 * Deliberately not a bare `.endsWith('.tmp')`. This sweeper is pointed at
 * directories that hold user-supplied filenames — the upload directory most of
 * all — and a user is entitled to store `notes.tmp`. Matching on the suffix
 * alone would delete their file sixty seconds later, which is a far worse
 * outcome than leaking the orphan this exists to reclaim.
 */
const ARTIFACT_PATTERN = /\.[0-9a-z]+-[0-9a-z]+-[0-9a-f]{8}\.tmp(\.stale)?$/;

/**
 * How old an artifact must be before it is deleted.
 *
 * A live writer's temp file is indistinguishable from an abandoned one by name
 * alone, so age is the only safe discriminator. One minute is far longer than
 * any write in this codebase and far shorter than the interval at which
 * sweeping matters.
 */
const DEFAULT_GRACE_MS = 60_000;

/**
 * Delete abandoned temp and steal artifacts under `dir`.
 *
 * Every atomic write cleans up after itself on the failure path and on process
 * exit, but neither of those runs when the process is SIGKILLed or the host
 * loses power. Without a sweep those files accumulate for the lifetime of the
 * deployment, and the first symptom is ENOSPC or an exhausted inode table on a
 * volume that looks half empty.
 *
 * Never throws: this is housekeeping, and a failure to tidy up must not fail
 * the operation that triggered it. Problems come back in the return value.
 *
 * @param {string} dir
 * @param {Object} [options]
 * @param {number} [options.graceMs=60000] - Minimum age before deletion.
 * @param {boolean} [options.recursive=false] - Descend into subdirectories.
 * @param {number} [options.maxDepth=8] - Guard against symlink loops.
 * @param {number} [options.concurrency=32]
 * @param {RegExp} [options.pattern] - Which names count as artifacts. Defaults
 *   to the exact shape `tempSuffix()` generates. Widen it only for a directory
 *   this application owns entirely, never one holding user-supplied names.
 * @returns {Promise<{ removed: number, bytes: number, failed: number, scanned: number }>}
 */
export async function sweepTemps(dir, options = {}) {
  const {
    graceMs = DEFAULT_GRACE_MS,
    recursive = false,
    maxDepth = 8,
    concurrency = 32,
    pattern = ARTIFACT_PATTERN,
  } = options;

  const cutoff = Date.now() - graceMs;
  const totals = { removed: 0, bytes: 0, failed: 0, scanned: 0 };

  const walk = async (current, depth) => {
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (!isMissingFsError(error)) totals.failed += 1;
      return;
    }

    totals.scanned += entries.length;

    await mapLimit(
      entries,
      async entry => {
        const full = path.join(current, entry.name);

        // isDirectory() is false for a symlink, so a link pointing at an
        // ancestor cannot be followed into an infinite descent.
        if (entry.isDirectory()) {
          if (recursive && depth < maxDepth) await walk(full, depth + 1);
          return;
        }
        if (!entry.isFile()) return;
        if (!pattern.test(entry.name)) return;

        try {
          const stats = await fsp.stat(full);
          if (stats.mtimeMs > cutoff) return;
          await fsp.unlink(full);
          totals.removed += 1;
          totals.bytes += stats.size;
        } catch (error) {
          // Someone else swept it, or it was renamed into place between the
          // readdir and the stat. Both are fine.
          if (!isMissingFsError(error)) totals.failed += 1;
        }
      },
      concurrency,
    );
  };

  await walk(dir, 0);
  return totals;
}
