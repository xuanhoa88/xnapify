#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const stylelint = require('stylelint');
const stylelintConfig = require('../../.stylelintrc');
const { BuildError } = require('../utils/error');
const {
  formatDuration,
  isSilent,
  isVerbose,
  logDebug,
  logError,
  logInfo,
  logWarn,
} = require('../utils/logger');

// Default patterns to lint
const DEFAULT_PATTERNS = [
  'src/**/*.css',
  'src/**/*.scss',
  'src/**/*.sass',
  'src/**/*.less',
];

/**
 * Format stylelint warning for display
 * @param {Object} warning - Stylelint warning object
 * @returns {string} - Formatted warning string
 */
function formatWarning(warning) {
  const severity = warning.severity === 'error' ? '❌' : '⚠️';
  return `${severity} ${warning.line}:${warning.column} - ${warning.text} (${warning.rule})`;
}

/**
 * Main stylelint task
 */
async function main() {
  const startTime = Date.now();
  const silent = isSilent();
  const verbose = isVerbose();

  if (!silent) {
    logInfo('🎨 Running Stylelint...');
  }

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const shouldFix = args.includes('--fix');
    const patterns = args.filter(arg => !arg.startsWith('--'));

    // Use provided patterns or defaults
    const filesToLint = patterns.length > 0 ? patterns : DEFAULT_PATTERNS;

    if (verbose) {
      logInfo(`📂 Linting patterns: ${filesToLint.join(', ')}`);
      if (shouldFix) {
        logInfo('🔧 Fix mode enabled');
      }
    }

    // Run stylelint
    const result = await stylelint.lint({
      files: filesToLint,
      config: stylelintConfig,
      fix: shouldFix,
      formatter: 'string',
    });

    // Process results
    const { results } = result;
    let errorCount = 0;
    let warningCount = 0;
    let fixedCount = 0;

    for (const fileResult of results) {
      const fileWarnings = fileResult.warnings || [];
      const fileErrors = fileWarnings.filter(w => w.severity === 'error');
      const fileWarningsOnly = fileWarnings.filter(
        w => w.severity === 'warning',
      );

      errorCount += fileErrors.length;
      warningCount += fileWarningsOnly.length;

      // Log file issues
      if (fileWarnings.length > 0 && verbose) {
        logDebug(`\n${fileResult.source}:`);
        fileWarnings.forEach(warning => {
          logDebug(`  ${formatWarning(warning)}`);
        });
      }

      // Count fixed issues if in fix mode
      if (
        shouldFix &&
        // eslint-disable-next-line no-underscore-dangle
        fileResult._postcssResult &&
        // eslint-disable-next-line no-underscore-dangle
        fileResult._postcssResult.stylelint
      ) {
        // eslint-disable-next-line no-underscore-dangle
        const { stylelint: meta } = fileResult._postcssResult;
        if (meta.fixed) {
          fixedCount++;
        }
      }
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // Report results
    if (!silent) {
      logInfo(`✅ Stylelint completed in ${formatDuration(duration)}`);
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
      if (result.output) {
        console.log(result.output);
      }
      throw new BuildError(`Stylelint found ${errorCount} error(s)`, {
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

    throw new BuildError(`Stylelint failed: ${error.message}`, {
      originalError: error.message,
    });
  }
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = main;
