/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';

import { AtomicFileError } from './errors.js';

/**
 * A caller-supplied path tried to leave the directory it was confined to.
 *
 * Its own class because the correct response is specific: this is never a
 * retry, never a fallback, and never a 404 — it is a rejected request that
 * should be logged as an attempt.
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
 * `/etc/passwd` quite happily. Anywhere a filename arrives from a request —
 * a query parameter, a route param, an upload's `originalname`, an extension id
 * — it has to be resolved and then *verified*, not merely joined.
 *
 * `resolve` rather than `join` is deliberate. `join` silently reinterprets an
 * absolute input as relative (`join('/uploads', '/etc/passwd')` →
 * `/uploads/etc/passwd`), which quietly serves a different file than the caller
 * asked for. `resolve` lets the absolute path win, which the containment check
 * then rejects outright — a refusal beats a surprise.
 *
 * @param {string} baseDir - The directory the result must stay within.
 * @param {string} userPath - Untrusted, relative to `baseDir`.
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

/**
 * {@link resolveWithin}, plus a check that the path is not a symlink pointing
 * out of `baseDir`.
 *
 * Lexical containment is not enough on its own once anything untrusted can
 * *create* entries in the directory — an uploaded archive, an extension
 * package. `uploads/evil` can be a symlink to `/etc`, and `uploads/evil/passwd`
 * is lexically impeccable. Only resolving the real path catches it.
 *
 * A path that does not exist yet is allowed through: its nearest existing
 * ancestor is checked instead, so a new file in a legitimate directory is fine
 * while a new file under a symlinked one is not.
 *
 * @param {string} baseDir
 * @param {string} userPath
 * @returns {Promise<string>}
 * @throws {PathEscapeError}
 */
export async function resolveWithinReal(baseDir, userPath) {
  const target = resolveWithin(baseDir, userPath);
  const base = await fsp
    .realpath(path.resolve(baseDir))
    .catch(() => path.resolve(baseDir));

  let probe = target;
  for (;;) {
    try {
      const real = await fsp.realpath(probe);
      const suffix = path.relative(probe, target);
      const resolved = suffix ? path.resolve(real, suffix) : real;
      if (resolved !== base && !resolved.startsWith(base + path.sep)) {
        throw new PathEscapeError(
          `Path escapes its base directory through a symlink: ` +
            `${JSON.stringify(userPath)} resolves to ${resolved}, outside ${base}`,
          { path: userPath, operation: 'resolveWithinReal' },
        );
      }
      return target;
    } catch (error) {
      if (error instanceof PathEscapeError) throw error;
      if (error.code !== 'ENOENT') {
        throw new PathEscapeError(
          `Cannot verify ${JSON.stringify(userPath)} is inside ${base}: ${error.message}`,
          {
            code: error.code,
            path: userPath,
            operation: 'resolveWithinReal',
            cause: error,
          },
        );
      }
      // Walk up to the nearest existing ancestor and check that instead.
      const parent = path.dirname(probe);
      if (parent === probe) return target;
      probe = parent;
    }
  }
}

/**
 * Reduce an untrusted name to a single, harmless path segment.
 *
 * For the case where the input should never have been a path at all — an
 * uploaded file's `originalname`, an extension id used as a directory name.
 * `path.basename` alone is not sufficient: it maps `".."` to `".."`, which then
 * means "parent" the moment it is joined, and an empty result would silently
 * target the containing directory itself.
 *
 * @param {string} name
 * @param {Object} [options]
 * @param {string} [options.fallback] - Returned instead of throwing when the
 *   input reduces to nothing usable.
 * @returns {string}
 * @throws {PathEscapeError} When there is no fallback and nothing usable remains.
 */
export function safeSegment(name, { fallback } = {}) {
  const raw = typeof name === 'string' ? name : '';
  // Both separators, so a Windows-style name is not treated as one segment on
  // POSIX and then split by something downstream.
  const base = path.basename(raw.replace(/\\/g, '/'));
  const cleaned = base.replace(/\0/g, '').trim();

  if (cleaned === '' || cleaned === '.' || cleaned === '..') {
    if (fallback !== undefined) return fallback;
    throw new PathEscapeError(
      `${JSON.stringify(name)} does not reduce to a usable filename`,
      { path: String(name), operation: 'safeSegment' },
    );
  }
  return cleaned;
}
