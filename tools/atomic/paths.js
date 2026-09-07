/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'node:path';

import { AtomicFileError } from './errors.js';

/**
 * A path tried to leave the directory it was confined to.
 *
 * Its own class because the correct response is specific: this is never a
 * retry and never a fallback — it is a refusal.
 */
export class PathEscapeError extends AtomicFileError {
  constructor(message, details) {
    super(message, details);
    this.name = 'PathEscapeError';
  }
}

/**
 * Resolve `userPath` against `baseDir`, guaranteeing the result stays inside it.
 *
 * `path.join(base, userPath)` is **not** a containment check and is the bug this
 * exists to prevent: `path.join('/uploads', '../../etc/passwd')` returns
 * `/etc/passwd` quite happily.
 *
 * The build's one caller is `preboot`, which derives MySQL data-directory names
 * from configuration and then *deletes* what it resolves. A name that escaped
 * would make that an `rm` outside the sandbox root, so the check is what keeps
 * a bad `XNAPIFY_DB_URL` from reaching outside its own directory.
 *
 * `resolve` rather than `join` is deliberate. `join` silently reinterprets an
 * absolute input as relative (`join('/uploads', '/etc/passwd')` →
 * `/uploads/etc/passwd`), which quietly targets a different file than the caller
 * asked for. `resolve` lets the absolute path win, which the containment check
 * then rejects outright — a refusal beats a surprise.
 *
 * @param {string} baseDir - The directory the result must stay within.
 * @param {string} userPath - Relative to `baseDir`.
 * @returns {string} An absolute path inside `baseDir`.
 * @throws {PathEscapeError}
 */
export function resolveWithin(baseDir, userPath) {
  if (typeof userPath !== 'string' || userPath.trim().length === 0) {
    throw new PathEscapeError(
      `Refusing to resolve an empty or non-string path inside ${baseDir}`,
      { path: String(userPath), operation: 'resolveWithin' },
    );
  }

  // A NUL truncates the path at the syscall boundary, so "safe.png\0../../etc"
  // passes a JS suffix check and then opens something else entirely. Node
  // rejects these itself, but doing it here keeps the error meaningful.
  if (userPath.includes('\0')) {
    throw new PathEscapeError(
      `Path contains a NUL byte: ${JSON.stringify(userPath)}`,
      {
        path: userPath,
        operation: 'resolveWithin',
      },
    );
  }

  const base = path.resolve(baseDir);
  const target = path.resolve(base, userPath);

  // The separator matters: without it, `/uploads-evil` passes a bare
  // `startsWith('/uploads')` test.
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new PathEscapeError(
      `Path escapes its base directory: ${JSON.stringify(userPath)} resolves outside ${base}`,
      { path: userPath, operation: 'resolveWithin' },
    );
  }

  return target;
}
