#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { spawn } = require('child_process');
const path = require('path');

const config = require('../config');
const { BuildError } = require('../utils/error');
const { isSilent, logDebug, logInfo } = require('../utils/logger');

/**
 * Run E2E Test runner
 */
async function main() {
  const silent = isSilent();

  if (!silent) {
    logInfo('🌐 Running E2E tests...');
  }

  return new Promise((resolve, reject) => {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Resolve runner script
    const runnerScript = path.resolve(__dirname, '..', 'e2e', 'runner.js');

    // Build arguments array
    const e2eArgs = [runnerScript, ...args];

    // Log command in debug mode
    logDebug(`Running: node ${e2eArgs.join(' ')}`);

    // Spawn E2E runner process
    const e2eProcess = spawn(process.execPath, e2eArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        CWD: config.CWD,
        E2E_VIA_TASK: '1',
      },
      cwd: config.CWD,
    });

    // Handle process completion
    e2eProcess.on('close', code => {
      if (code === 0) {
        if (!silent) {
          logInfo('✅ E2E Tests finished successfully');
        }
        resolve({ success: true, exitCode: code });
      } else {
        reject(
          new BuildError(`E2E tests failed with exit code ${code}`, {
            exitCode: code,
          }),
        );
      }
    });

    // Handle process errors
    e2eProcess.on('error', error => {
      reject(
        new BuildError(`Failed to run E2E tests: ${error.message}`, {
          originalError: error.message,
        }),
      );
    });
  });
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = main;
