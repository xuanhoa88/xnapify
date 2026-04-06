#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { spawn } = require('child_process');

const config = require('../config');
const { BuildError } = require('../utils/error');
const { isSilent, isVerbose, logDebug, logInfo } = require('../utils/logger');

/**
 * Run Jest tests
 */
async function main() {
  const silent = isSilent();
  const verbose = isVerbose();

  if (!silent) {
    logInfo('🧪 Running tests...');
  }

  return new Promise((resolve, reject) => {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Check for common flags
    const isWatch = args.includes('--watch') || args.includes('-w');
    const isCoverage = args.includes('--coverage');

    // Build Jest arguments
    const jestArgs = [
      // Config file
      '--config',
      require.resolve('../jest'),

      // Pass through user arguments
      ...args,
    ];

    // Add CI-specific options
    if (!args.includes('--ci')) {
      jestArgs.push('--ci');
    }

    // Add verbose if enabled and not already specified
    if (verbose && !args.includes('--verbose')) {
      jestArgs.push('--verbose');
    }

    // Log jest command in debug mode
    logDebug(`Running: jest ${jestArgs.join(' ')}`);

    // Resolve local jest binary dynamically from package.json (avoids hardcoding paths)
    const path = require('path');
    const jestPkgPath = require.resolve('jest/package.json');
    const jestPkg = require(jestPkgPath);
    const binPath =
      typeof jestPkg.bin === 'string' ? jestPkg.bin : jestPkg.bin.jest;
    const jestBin = path.join(path.dirname(jestPkgPath), binPath);

    // Spawn Jest process
    const jestProcess = spawn(process.execPath, [jestBin, ...jestArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CWD: config.CWD,
        // Enable coverage if flag is set
        ...(isCoverage && { COVERAGE: 'true' }),
        // Enable watch mode flag
        ...(isWatch && { JEST_WATCH: 'true' }),
      },
      cwd: config.CWD,
    });

    // Handle process completion
    jestProcess.on('close', code => {
      if (code === 0) {
        if (!silent) {
          logInfo('✅ Tests passed');
        }
        resolve({ success: true, exitCode: code });
      } else {
        reject(
          new BuildError(`Tests failed with exit code ${code}`, {
            exitCode: code,
          }),
        );
      }
    });

    // Handle process errors
    jestProcess.on('error', error => {
      reject(
        new BuildError(`Failed to run tests: ${error.message}`, {
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
