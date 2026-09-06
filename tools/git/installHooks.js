#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 *
 * Install the tracked git hooks by pointing core.hooksPath at
 * tools/git/hooks. Run by `npm run setup`.
 *
 * Why hooksPath rather than copying into .git/hooks: a copy drifts. The
 * repo's previous hook lived only in .git/hooks, referenced a scanner
 * filename that did not exist, and guarded that reference with `[ -f ]` — so
 * it silently ran nothing on every commit for as long as it existed, and no
 * clone but that one had a hook at all. A tracked directory is reviewable,
 * ships with the repo, and cannot drift from what is committed.
 *
 * Usage:
 *   node tools/git/installHooks.js
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);

/** Path git is pointed at, relative to the top of the working tree. */
export const HOOKS_PATH = 'tools/git/hooks';

const defaultLogger = {
  log: msg => console.log(msg),
  warn: msg => console.warn(`⚠️  ${msg}`),
};

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Point this clone's git at the tracked hooks directory.
 *
 * Never throws and never fails a build: a missing git binary or a source
 * tarball with no .git is a legitimate way to consume this repo. The return
 * value says what happened so callers (and tests) can tell the cases apart.
 *
 * @returns {{status: string, reason?: string, warnings: string[]}}
 */
export function installHooks({
  root = process.cwd(),
  logger = defaultLogger,
} = {}) {
  const warnings = [];

  const hooksDir = path.join(root, HOOKS_PATH);
  if (!fs.existsSync(hooksDir)) {
    return {
      status: 'skipped',
      reason: `${HOOKS_PATH} does not exist`,
      warnings,
    };
  }

  let insideRepo;
  try {
    insideRepo = git(['rev-parse', '--is-inside-work-tree'], root) === 'true';
  } catch {
    return { status: 'skipped', reason: 'git is unavailable', warnings };
  }
  if (!insideRepo) {
    return { status: 'skipped', reason: 'not a git working tree', warnings };
  }

  // git silently ignores a hook that is not executable — the same class of
  // failure as the missing scanner, so repair it rather than report it.
  for (const entry of fs.readdirSync(hooksDir)) {
    const file = path.join(hooksDir, entry);
    if (!fs.statSync(file).isFile()) continue;
    try {
      fs.accessSync(file, fs.constants.X_OK);
    } catch {
      fs.chmodSync(file, 0o755);
      warnings.push(`made ${HOOKS_PATH}/${entry} executable`);
    }
  }

  let current = null;
  try {
    current = git(['config', '--local', '--get', 'core.hooksPath'], root);
  } catch {
    // Unset — git exits 1 with no output.
  }

  // A hook left in .git/hooks is shadowed by hooksPath and will never run
  // again. Say so; silently dead hooks are what this module exists to end.
  const legacy = path.join(root, '.git', 'hooks');
  if (fs.existsSync(legacy)) {
    const shadowed = fs
      .readdirSync(legacy)
      .filter(name => !name.endsWith('.sample'));
    if (shadowed.length > 0) {
      warnings.push(
        `.git/hooks still contains ${shadowed.join(', ')} — now shadowed by ${HOOKS_PATH} and no longer run`,
      );
    }
  }

  if (current === HOOKS_PATH) {
    for (const warning of warnings) logger.warn(warning);
    return { status: 'already-set', warnings };
  }

  try {
    git(['config', '--local', 'core.hooksPath', HOOKS_PATH], root);
  } catch (error) {
    return { status: 'failed', reason: error.message, warnings };
  }

  for (const warning of warnings) logger.warn(warning);
  return { status: 'installed', warnings };
}

export default installHooks;

// Execute if called directly (as child process)
if (
  process.argv[1] &&
  (process.argv[1] === currentFilename ||
    process.argv[1] === currentFilename.replace(/\.js$/, '') ||
    process.argv[1].endsWith('installHooks.js'))
) {
  const result = installHooks();
  const message = {
    installed: `✅ git hooks installed (core.hooksPath=${HOOKS_PATH})`,
    'already-set': `✅ git hooks already installed (core.hooksPath=${HOOKS_PATH})`,
    skipped: `git hooks not installed: ${result.reason}`,
    failed: `git hooks could not be installed: ${result.reason}`,
  }[result.status];
  if (result.status === 'installed' || result.status === 'already-set') {
    console.log(message);
  } else {
    console.warn(`⚠️  ${message}`);
  }
}
