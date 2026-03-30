#!/usr/bin/env node

/**
 * Preinstall guard — blocks bare `npm install` (use `npm run setup` instead).
 * Allows `npm install <package>` through automatically.
 *
 * Cross-platform: macOS, Linux, Windows.
 */

'use strict';

// Authorized by setup.js
if (process.env.XNAPIFY_SETUP) process.exit(0);

// ─── Detect if npm was invoked with package arguments ────────────────────────

/**
 * Check npm_config_argv (npm v6-v8) for positional package arguments.
 * @returns {boolean|null} true = adding package, false = bare install, null = not available
 */
function checkNpmArgv() {
  try {
    const argv = JSON.parse(process.env.npm_config_argv || '');
    const remain = argv.remain || [];
    return remain.length > 0;
  } catch {
    return null;
  }
}

/**
 * Walk up the process tree to find the original npm command.
 * Uses platform-specific commands with graceful fallback.
 * @returns {boolean}
 */
function checkProcessTree() {
  const { execSync } = require('child_process');
  const isWin = process.platform === 'win32';

  try {
    let pid = process.ppid;
    for (let depth = 0; depth < 5; depth++) {
      let cmd = '';

      if (isWin) {
        // Windows: use wmic (available on all Windows versions)
        cmd = execSync(
          'wmic process where "ProcessId=' + pid + '" get CommandLine /value',
          { encoding: 'utf8', timeout: 2000, windowsHide: true },
        ).trim();
      } else {
        // macOS / Linux
        cmd = execSync('ps -p ' + pid + ' -o args=', {
          encoding: 'utf8',
          timeout: 1000,
        }).trim();
      }

      if (/\bnpm\b/i.test(cmd)) {
        // `npm install foo` or `npm i -D bar` — has args after install/i/add
        return /npm\s+(install|i|add)\s+\S/i.test(cmd);
      }

      // Walk up to parent
      if (isWin) {
        const match = execSync(
          'wmic process where "ProcessId=' +
            pid +
            '" get ParentProcessId /value',
          { encoding: 'utf8', timeout: 2000, windowsHide: true },
        ).match(/ParentProcessId=(\d+)/);
        pid = match ? parseInt(match[1], 10) : 0;
      } else {
        const ppid = execSync('ps -p ' + pid + ' -o ppid=', {
          encoding: 'utf8',
          timeout: 1000,
        }).trim();
        pid = parseInt(ppid, 10);
      }

      if (!pid || pid <= 1) break;
    }
  } catch {
    // Command not available — fall through to block
  }
  return false;
}

function isAddingPackage() {
  // 1. Check npm_config_argv (fastest, cross-platform, npm v6-v8)
  const result = checkNpmArgv();
  if (result !== null) return result;

  // 2. Walk process tree (platform-specific fallback)
  return checkProcessTree();
}

if (isAddingPackage()) process.exit(0);

// ─── Block bare `npm install` ────────────────────────────────────────────────

console.error(
  ['', '❌ Use "npm run setup" instead of "npm install"', ''].join('\n'),
);
process.exit(1);
