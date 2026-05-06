#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { fileURLToPath } from 'url';

import { ESLint } from 'eslint';

import { BuildError } from '../utils/error.js';
import {
  formatDuration,
  logVerbose,
  logError,
  logInfo,
  logWarn,
  isSilent,
} from '../utils/logger.js';

// Cache silent check for use throughout the task
const silent = isSilent();

/**
 * Main jslint task
 */
async function main() {
  const startTime = Date.now();

  if (!silent) {
    logInfo('🧹 Running ESLint...');
  }

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const shouldFix = args.includes('--fix');
    const patterns = args.filter(arg => !arg.startsWith('--'));

    // Use provided patterns or defaults
    const filesToLint = patterns.length > 0 ? patterns : ['.'];

    logVerbose(`📂 Linting patterns: ${filesToLint.join(', ')}`);
    if (shouldFix) {
      logVerbose('🔧 Fix mode enabled');
    }

    // Run eslint
    const eslint = new ESLint({ fix: shouldFix });
    const results = await eslint.lintFiles(filesToLint);

    if (shouldFix) {
      await ESLint.outputFixes(results);
    }

    // Process results
    let errorCount = 0;
    let warningCount = 0;
    let fixedCount = 0;

    for (const fileResult of results) {
      errorCount += fileResult.errorCount;
      warningCount += fileResult.warningCount;

      if (fileResult.output) {
        // Output exists if fix mode was enabled and changes were made
        fixedCount++;
      }
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // Report results
    if (!silent) {
      logInfo(`✅ ESLint completed in ${formatDuration(duration)}`);
      logInfo(`   📁 Files checked: ${results.length}`);

      if (errorCount > 0) {
        logError(`   ❌ Errors: ${errorCount}`);
      }

      if (warningCount > 0) {
        logWarn(`   ⚠️ Warnings: ${warningCount}`);
      }

      if (shouldFix && fixedCount > 0) {
        logInfo(`   🔧 Files fixed: ${fixedCount}`);
      }

      if (errorCount === 0 && warningCount === 0) {
        logInfo('   ✨ No issues found');
      }
    }

    // Exit with error if there are errors
    if (errorCount > 0) {
      const formatter = await eslint.loadFormatter('stylish');
      const resultText = await formatter.format(results);
      if (resultText) {
        console.log(resultText);
      }
      throw new BuildError(`ESLint found ${errorCount} error(s)`, {
        errorCount,
        warningCount,
      });
    }

    return {
      success: true,
      filesChecked: results.length,
      errors: errorCount,
      warnings: warningCount,
      fixed: fixedCount,
      duration,
    };
  } catch (error) {
    if (error instanceof BuildError) {
      throw error;
    }

    throw new BuildError(`ESLint failed: ${error.message}`, {
      originalError: error.message,
    });
  }
}

// Execute if called directly (as child process)
const scriptPath = fileURLToPath(import.meta.url);
const isMain =
  process.argv[1] === scriptPath ||
  process.argv[1] === scriptPath.replace(/\.js$/, '');
if (isMain) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

export default main;
