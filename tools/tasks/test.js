#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { spawn } from 'child_process';
import path from 'path';
import config from '../config';
import { BuildError } from '../lib/errorHandler';
import { isSilent, isVerbose, logError, logInfo } from '../lib/logger';

const silent = isSilent();
const verbose = isVerbose();

/**
 * Run Jest tests with appropriate configuration
 *
 * @param {Object} options - Test options
 * @param {boolean} options.watch - Run tests in watch mode
 * @param {boolean} options.coverage - Generate coverage report
 * @param {boolean} options.ci - Run in CI mode
 * @param {string[]} options.args - Additional Jest arguments
 * @returns {Promise<void>}
 */
function runJest(options = {}) {
  return new Promise((resolve, reject) => {
    const jestArgs = [];

    // Add configuration
    jestArgs.push('--config', path.join(__dirname, '..', 'jest', 'config.js'));

    // Add mode-specific flags
    if (options.watch) {
      jestArgs.push('--watch');
    }

    if (options.coverage) {
      jestArgs.push('--coverage');
    }

    if (options.ci) {
      jestArgs.push('--ci', '--coverage', '--maxWorkers=2');
    }

    // Add verbosity flags
    if (verbose) {
      jestArgs.push('--verbose');
    }

    if (silent) {
      jestArgs.push('--silent');
    }

    // Add any additional arguments passed from CLI
    if (options.args && options.args.length > 0) {
      jestArgs.push(...options.args);
    }

    if (!silent) {
      const mode = options.watch
        ? 'watch mode'
        : options.ci
          ? 'CI mode'
          : options.coverage
            ? 'with coverage'
            : 'standard mode';
      logInfo(`🧪 Running tests (${mode})...`);
    }

    // Spawn Jest process
    const jestProcess = spawn('jest', jestArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CI: options.ci ? 'true' : process.env.CI,
      },
      cwd: config.CWD,
    });

    // Handle process exit
    jestProcess.on('exit', (code, signal) => {
      if (signal) {
        reject(
          new BuildError(`Jest killed by signal ${signal}`, {
            task: 'test',
            signal,
          }),
        );
      } else if (code !== 0) {
        reject(
          new BuildError(`Tests failed with exit code ${code}`, {
            task: 'test',
            exitCode: code,
          }),
        );
      } else {
        if (!silent) {
          logInfo('✅ All tests passed');
        }
        resolve();
      }
    });

    // Handle process errors
    jestProcess.on('error', error => {
      reject(
        new BuildError(`Failed to run Jest: ${error.message}`, {
          task: 'test',
          originalError: error.message,
          suggestion: 'Make sure Jest is installed: npm install',
        }),
      );
    });
  });
}

/**
 * Main test task function
 * Parses CLI arguments and runs Jest with appropriate options
 */
export default async function main() {
  const startTime = Date.now();

  try {
    // Parse CLI arguments
    const args = process.argv.slice(2);
    const options = {
      watch: args.includes('--watch') || args.includes('-w'),
      coverage: args.includes('--coverage') || args.includes('--cov'),
      ci: args.includes('--ci'),
      args: args.filter(
        arg =>
          ![
            '--watch',
            '-w',
            '--coverage',
            '--cov',
            '--ci',
            '--verbose',
            '--silent',
          ].includes(arg),
      ),
    };

    // Run Jest
    await runJest(options);

    // Log completion (unless in watch mode or silent)
    if (!options.watch && !silent) {
      const duration = Date.now() - startTime;
      logInfo(`\n✅ Tests completed in ${Math.round(duration / 1000)}s`);

      // Show coverage location if generated
      if (options.coverage || options.ci) {
        const coverageDir = path.join(config.CWD, 'coverage');
        logInfo(`📊 Coverage report: ${coverageDir}/lcov-report/index.html`);
      }
    }
  } catch (error) {
    const testError =
      error instanceof BuildError
        ? error
        : new BuildError(`Test task failed: ${error.message}`, {
            task: 'test',
            originalError: error.message,
          });

    if (!silent) {
      let errorMessage = `\n❌ ${testError.message}`;

      if (verbose && testError.stack) {
        errorMessage += `\n\nStack trace:\n${testError.stack}`;
      }

      errorMessage += '\n\n💡 Troubleshooting:';
      errorMessage += '\n   1. Check test files for syntax errors';
      errorMessage += '\n   2. Run: npm install';
      errorMessage += '\n   3. Check tools/jest/config.js configuration';

      logError(errorMessage);
    }

    throw testError;
  }
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
