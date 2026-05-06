#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Preinstall guard — blocks bare `npm install` (use `npm run setup` instead).
 * Allows `npm ci` and `npm install <package>` through automatically.
 *
 * Note: Since npm v7+, the preinstall hook is NO LONGER executed when
 * adding specific packages (e.g., `npm install lodash`). It is only executed
 * on bare `npm install` and `npm ci`. Therefore, complex OS-specific process
 * tree walking (using ps / wmic) is completely obsolete and has been removed!
 */

// Authorized by setup.js via `npm install --xnapify-setup`
if (process.env.npm_config_xnapify_setup) process.exit(0);

// Allow `npm ci` for clean CI/CD pipelines
if (process.env.npm_command === 'ci') process.exit(0);

// ─── Block bare `npm install` ────────────────────────────────────────────────

console.error(
  ['', '❌ Use "npm run setup" instead of "npm install"', ''].join('\n'),
);
process.exit(1);
