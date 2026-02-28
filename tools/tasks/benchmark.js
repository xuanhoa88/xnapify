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
const { isSilent, isVerbose, logDebug, logInfo } = require('../utils/logger');

async function main() {
  const silent = isSilent();
  const verbose = isVerbose();

  if (!silent) {
    logInfo('📏 Running benchmark suites...');
  }

  return new Promise((resolve, reject) => {
    const args = process.argv.slice(2);

    // Build jest arguments. We force runInBand so that timing numbers are
    // more stable (no worker startup overhead), but users can override if
    // they like.
    const jestArgs = [
      '--config',
      require.resolve('../jest'),
      '--runInBand',
      // pass through user arguments (e.g. `--maxWorkers=2`)
      ...args,
    ];

    // log command in debug mode
    logDebug(`Running benchmark jest ${jestArgs.join(' ')}`);

    const jestProcess = spawn('jest', jestArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
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
