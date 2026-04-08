#!/usr/bin/env node

/**
 * Run benchmark suites using Jest. Benchmarks are simple jest files
 * ending with `.benchmark.js` and are only executed when the
 * JEST_BENCHMARK environment variable is set. This task wraps the
 * existing test infrastructure so you can reuse babel-jest, module
 * aliases, etc.
 */

const { spawn } = require('child_process');

const config = require('../config');
const { BuildError } = require('../utils/error');
const { resolveJestBin } = require('../utils/jest');
const { isSilent, logDebug, logInfo } = require('../utils/logger');

async function main() {
  const silent = isSilent();

  if (!silent) {
    logInfo('📏 Running benchmark suites...');
  }

  return new Promise((resolve, reject) => {
    const args = process.argv.slice(2);

    // Build jest arguments. We force runInBand so that timing numbers are
    // more stable (no worker startup overhead), but users can override if
    // they like.
    const jestArgs = [
      // Config file
      '--config',
      require.resolve('../jest'),

      // Run in single thread
      '--runInBand',

      // Disable cache
      '--no-cache',

      // pass through user arguments (e.g. `--maxWorkers=2`)
      ...args,
    ];

    // Resolve Jest binary path
    const jestBin = resolveJestBin(config.CWD);

    // log command in debug mode
    logDebug(`Running benchmark jest ${jestArgs.join(' ')}`);

    const jestProcess = spawn(process.execPath, [jestBin, ...jestArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        JEST_BENCHMARK: 'true',
      },
      cwd: config.CWD,
    });

    jestProcess.on('close', code => {
      if (code === 0) {
        if (!silent) {
          logInfo('✅ Benchmarks finished successfully');
        }
        resolve({ success: true, exitCode: code });
      } else {
        reject(
          new BuildError(`Benchmarks failed with exit code ${code}`, {
            exitCode: code,
          }),
        );
      }
    });

    jestProcess.on('error', error => {
      reject(
        new BuildError(`Failed to run benchmarks: ${error.message}`, {
          originalError: error.message,
        }),
      );
    });
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = main;
