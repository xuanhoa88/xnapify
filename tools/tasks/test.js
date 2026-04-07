#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

    // Safely execute using Node itself if we can resolve the binary directly
    let jestBin;

    const jestBinTargets = ['jest/bin/jest.js', 'jest-cli/bin/jest.js'];
    for (const target of jestBinTargets) {
      try {
        jestBin = require.resolve(target);
        break;
      } catch {
        // Continue looking
      }
    }

    if (!jestBin) {
      const possiblePaths = [
        path.resolve(require.resolve('jest'), '../../bin/jest.js'),
        path.resolve(config.CWD, 'node_modules/jest/bin/jest.js'),
        path.resolve(config.CWD, 'node_modules/jest-cli/bin/jest.js'),
        path.resolve(config.CWD, 'node_modules/.bin/jest'),
        path.resolve(config.CWD, 'node_modules/.bin/jest-cli'),
      ];
      jestBin = possiblePaths.find(p => fs.existsSync(p));
    }

    if (!jestBin) {
      throw new BuildError('Could not find Jest binary', { exitCode: 1 });
    }

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
