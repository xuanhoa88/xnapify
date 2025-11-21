#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Stylelint CSS Linting Script
 *
 * This script reads file patterns from .stylelintrc.js and runs stylelint.
 * Features:
 * - Centralized pattern configuration
 * - Automatic fixing with --fix flag
 * - Pattern-specific linting (all, css, scss, sass)
 * - Performance tracking
 * - Enhanced error reporting
 * - Verbose mode support
 *
 * Usage:
 *   babel-node tools/tasks/stylelint              # Lint all CSS files
 *   babel-node tools/tasks/stylelint --fix        # Lint and fix CSS files
 *   babel-node tools/tasks/stylelint scss         # Lint only SCSS files
 *   babel-node tools/tasks/stylelint css --fix    # Lint and fix only CSS files
 *   LOG_LEVEL=verbose babel-node tools/tasks/stylelint  # Verbose output
 */

import { performance } from 'perf_hooks';
import stylelint from 'stylelint';
import stylelintConfig from '../../.stylelintrc';
import { BuildError, logDetailedError } from '../lib/errorHandler';
import {
  formatDuration,
  isVerbose,
  logError,
  logInfo,
  logVerbose,
  logWarn,
} from '../lib/logger';

/**
 * Main linting function
 * Export as default for task runner compatibility
 */
export default async function main() {
  const startTime = performance.now();

  try {
    // Parse command line arguments
    // When run via 'babel-node tools/run stylelint', process.argv includes:
    // [node, tools/run, stylelint, ...actual args]
    // We need to filter out 'stylelint' (the task name) from the arguments
    const args = process.argv.slice(2).filter(arg => arg !== 'stylelint');
    const isFix = args.includes('--fix');
    const isQuiet = args.includes('--quiet');
    const patternName = args.find(arg => !arg.startsWith('--')) || 'all';

    // Validate pattern exists
    if (!stylelintConfig.patterns) {
      throw new BuildError('No patterns found in .stylelintrc.js', {
        suggestion:
          'Add a patterns object to your .stylelintrc.js configuration',
      });
    }

    // Get the pattern to use
    const pattern = stylelintConfig.patterns[patternName];
    if (!pattern) {
      const availablePatterns = Object.keys(stylelintConfig.patterns).join(
        ', ',
      );
      throw new BuildError(
        `Pattern '${patternName}' not found in .stylelintrc.js`,
        {
          availablePatterns,
          suggestion: `Use one of: ${availablePatterns}`,
        },
      );
    }

    // Log what we're doing
    logInfo(
      `🎨 ${isFix ? 'Linting and fixing' : 'Linting'} CSS files: ${pattern}`,
    );
    if (isVerbose()) {
      logVerbose(
        `   Pattern type: ${patternName}\n` +
          `   Fix mode: ${isFix}\n` +
          `   Quiet mode: ${isQuiet}`,
      );
    }

    // Run stylelint
    const result = await stylelint.lint({
      files: pattern,
      config: stylelintConfig,
      fix: isFix,
    });

    const { errored, results } = result;
    const duration = performance.now() - startTime;

    // Count issues
    const errorCount = results.reduce(
      (sum, file) =>
        sum + file.warnings.filter(w => w.severity === 'error').length,
      0,
    );
    const warningCount = results.reduce(
      (sum, file) =>
        sum + file.warnings.filter(w => w.severity === 'warning').length,
      0,
    );
    const filesWithIssues = results.filter(f => f.warnings.length > 0).length;

    // Display results (unless quiet mode)
    if (!isQuiet) {
      results.forEach(file => {
        if (file.warnings.length > 0) {
          logInfo(`\n${file.source}:`);
          file.warnings.forEach(warning => {
            const icon = warning.severity === 'error' ? '❌' : '⚠️ ';
            const severity = warning.severity === 'error' ? 'error' : 'warning';
            logInfo(
              `  ${icon} ${warning.line}:${warning.column}  ${warning.text}  [${warning.rule}] (${severity})`,
            );
          });
        }
      });
    }

    // Summary
    logInfo(`\n📊 Linting summary:`);
    logInfo(`   Files checked: ${results.length}`);
    logInfo(`   Files with issues: ${filesWithIssues}`);
    logInfo(`   Errors: ${errorCount}`);
    logInfo(`   Warnings: ${warningCount}`);
    logInfo(`   Duration: ${formatDuration(duration)}`);

    if (isFix && (errorCount > 0 || warningCount > 0)) {
      logInfo(`   🔧 Auto-fixed issues where possible`);
    }

    // Exit with appropriate status
    if (errored) {
      throw new Error(`CSS linting failed with ${errorCount} errors`);
    }

    if (warningCount > 0) {
      logWarn(`\n⚠️ Found ${warningCount} warnings`);
    }

    logInfo(
      `\n✅ CSS linting completed${isFix ? ' and fixed' : ''} successfully!`,
    );
  } catch (error) {
    const duration = performance.now() - startTime;

    if (error instanceof BuildError) {
      logDetailedError(error, {
        operation: 'stylelint',
        duration: formatDuration(duration),
      });
    } else {
      const verbose = isVerbose();
      let errorMessage = `❌ Error running stylelint: ${error.message}`;

      if (verbose && error.stack) {
        errorMessage += `\n\n   Stack trace:\n${error.stack}`;
      }

      logError(errorMessage);
    }

    throw error;
  }
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
