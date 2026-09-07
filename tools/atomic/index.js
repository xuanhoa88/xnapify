/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Crash-safe filesystem primitives for the build toolchain.
 *
 * `tools/` is a build-time package: it launches the dev server and produces the
 * Plug & Play extension bundles. It is not the runtime, so this is deliberately
 * *not* a copy of `shared/utils/atomic` — that module serves long-lived cluster
 * workers and carries machinery this one has no use for (background temp
 * sweeping, read-modify-write helpers, symlink-aware containment for untrusted
 * uploads). See ./README.md for what was dropped and why.
 *
 * What is kept is what the build genuinely depends on. Two of the files written
 * through here are the developer's only copy rather than a regenerable
 * artifact — `.env` and the `XNAPIFY_KEY` inside it — so atomic replacement,
 * permission inheritance and the cross-process lock all stay.
 *
 * Depends on nothing but `node:` builtins — no `@shared` alias, no container,
 * no logger — so `tools/` stays a standalone package that raw Node can run
 * before a single dependency is installed.
 *
 * This surface is exactly what `tools/` imports today. Adding a consumer for
 * anything else means exporting it here first; a stale import fails loudly at
 * module load ("does not provide an export named ..."), never silently as
 * `undefined`.
 */

export { isMissingFsError } from './errors.js';

export {
  ensureDir,
  tempSuffix,
  writeFileAtomic,
  writeFileAtomicSync,
  writeJsonAtomicSync,
} from './write.js';

export { readFileSafeSync, readJsonSafeSync } from './read.js';

export { withFileLock } from './lock.js';

export { resolveWithin } from './paths.js';

export { mapLimit } from './concurrency.js';
