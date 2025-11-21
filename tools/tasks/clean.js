#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import config from '../config';
import {
  BuildError,
  logDetailedError,
  withFileSystemRetry,
} from '../lib/errorHandler';
import { cleanDir, getFileInfo, readDir } from '../lib/fs';
import {
  formatBytes,
  formatDuration,
  isVerbose,
  logDebug,
  logInfo,
  logVerbose,
  logWarn,
} from '../lib/logger';

// Enhanced state management
const state = {
  cleanedPaths: new Set(),
  preservedPaths: new Set(),
  stats: {
    totalFiles: 0,
    totalDirectories: 0,
    deletedFiles: 0,
    deletedDirectories: 0,
    preservedItems: 0,
    totalSize: 0,
    freedSpace: 0,
    errors: 0,
    startTime: null,
    endTime: null,
  },
};

/**
 * Calculate directory size recursively
 */
async function calculateDirectorySize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;

  try {
    const items = await readDir(dirPath, { withFileTypes: true });

    // Process all items in parallel using Promise.all
    const results = await Promise.all(
      items.map(async item => {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          const subDirInfo = await calculateDirectorySize(itemPath);
          return {
            totalSize: subDirInfo.totalSize,
            fileCount: subDirInfo.fileCount,
            dirCount: subDirInfo.dirCount + 1, // +1 for the directory itself
          };
        }

        if (item.isFile()) {
          const fileInfo = await getFileInfo(itemPath);
          return {
            totalSize: fileInfo.size,
            fileCount: 1,
            dirCount: 0,
          };
        }

        // Skip other types (symlinks, etc.)
        return { totalSize: 0, fileCount: 0, dirCount: 0 };
      }),
    );

    // Aggregate results using reduce
    const aggregated = results.reduce(
      (acc, result) => ({
        totalSize: acc.totalSize + result.totalSize,
        fileCount: acc.fileCount + result.fileCount,
        dirCount: acc.dirCount + result.dirCount,
      }),
      { totalSize: 0, fileCount: 0, dirCount: 0 },
    );

    totalSize = aggregated.totalSize;
    fileCount = aggregated.fileCount;
    dirCount = aggregated.dirCount;
  } catch (error) {
    logDebug(`Failed to calculate size for ${dirPath}: ${error.message}`);
  }

  return { totalSize, fileCount, dirCount };
}

/**
 * Check if path should be preserved based on configuration
 */
function shouldPreservePath(targetPath, pathInfo, options = {}) {
  const { preserveGit = true, maxAge = 7 * 24 * 60 * 60 * 1000 } = options;

  const relativePath = path.relative(process.cwd(), targetPath);

  // Always preserve git directories if configured
  if (
    preserveGit &&
    (relativePath.includes('.git') || relativePath.endsWith('.git'))
  ) {
    return { preserve: true, reason: 'Git directory preservation enabled' };
  }

  // Check age-based preservation
  if (
    pathInfo &&
    pathInfo.age < maxAge &&
    process.argv.includes('--preserve-recent')
  ) {
    return {
      preserve: true,
      reason: `File too recent (${formatDuration(pathInfo.age)} old)`,
    };
  }

  return { preserve: false };
}

/**
 * Enhanced directory cleaning with progress tracking
 */
async function enhancedCleanDir(targetPath, options = {}) {
  const startTime = Date.now();
  const { preserveGit, maxAge, isDryRun, ...cleanOptions } = options;

  try {
    logDebug(`Cleaning directory: ${targetPath}`);

    // Check if this is a glob pattern (contains *, ?, [, etc.)
    const isGlobPattern = /[*?[]/.test(targetPath);

    // Initialize variables outside the if block for proper scoping
    let pathInfo = null;
    let sizeInfo = { totalSize: 0, fileCount: 0, dirCount: 0 };

    // For glob patterns, skip existence check and let rimraf handle it
    if (!isGlobPattern) {
      pathInfo = await getFileInfo(targetPath);
      if (!pathInfo.exists) {
        logDebug(`Path does not exist: ${targetPath}`);
        return { skipped: true, reason: 'Path does not exist' };
      }

      // Check if path should be preserved
      const preserveCheck = shouldPreservePath(targetPath, pathInfo, {
        preserveGit,
        maxAge,
      });
      if (preserveCheck.preserve) {
        state.preservedPaths.add(targetPath);
        // eslint-disable-next-line no-plusplus
        state.stats.preservedItems++;
        logDebug(`Preserved ${targetPath}: ${preserveCheck.reason}`);
        return { preserved: true, reason: preserveCheck.reason };
      }

      // Calculate size before deletion for statistics
      if (pathInfo.isDirectory) {
        sizeInfo = await calculateDirectorySize(targetPath);
        state.stats.totalDirectories += sizeInfo.dirCount;
        state.stats.totalFiles += sizeInfo.fileCount;
      } else {
        sizeInfo.totalSize = pathInfo.size;
        // eslint-disable-next-line no-plusplus
        state.stats.totalFiles++;
      }

      state.stats.totalSize += sizeInfo.totalSize;
    } else {
      // For glob patterns, we can't calculate size beforehand
      logDebug(`Using glob pattern: ${targetPath}`);
    }

    // Perform cleaning (or dry run)
    if (isDryRun) {
      logInfo(
        `[DRY RUN] Would delete: ${targetPath} (${formatBytes(
          sizeInfo.totalSize,
        )})`,
      );
      return { dryRun: true, size: sizeInfo.totalSize, ...sizeInfo };
    }

    await cleanDir(targetPath, {
      nosort: true,
      dot: true,
      ...cleanOptions,
    });

    const duration = Date.now() - startTime;
    state.cleanedPaths.add(targetPath);
    state.stats.freedSpace += sizeInfo.totalSize;

    // Update stats based on what was cleaned
    if (pathInfo && pathInfo.isDirectory) {
      // eslint-disable-next-line no-plusplus
      state.stats.deletedDirectories++;
    } else if (pathInfo && pathInfo.isFile) {
      // eslint-disable-next-line no-plusplus
      state.stats.deletedFiles++;
    }
    // For glob patterns (pathInfo is null), stats are already updated from sizeInfo

    logVerbose(
      `Cleaned ${targetPath} (${formatBytes(
        sizeInfo.totalSize,
      )}, ${duration}ms)`,
    );

    return {
      cleaned: true,
      duration,
      size: sizeInfo.totalSize,
      ...sizeInfo,
    };
  } catch (error) {
    // eslint-disable-next-line no-plusplus
    state.stats.errors++;

    const cleanError = new BuildError(
      `Failed to clean ${targetPath}: ${error.message}`,
      {
        targetPath,
        originalError: error.message,
      },
    );

    logDetailedError(cleanError, { operation: 'clean-directory' });

    // Don't throw here, continue with other paths
    return { error: true, message: error.message };
  }
}

/**
 * Get cleaning statistics
 */
function getCleanStats() {
  const duration = state.stats.endTime
    ? state.stats.endTime.getTime() - state.stats.startTime.getTime()
    : 0;

  return {
    ...state.stats,
    duration,
    cleanedPaths: Array.from(state.cleanedPaths),
    preservedPaths: Array.from(state.preservedPaths),
    efficiency:
      state.stats.totalSize > 0
        ? (state.stats.freedSpace / state.stats.totalSize) * 100
        : 0,
  };
}

/**
 * Enhanced clean operation with comprehensive error handling and performance monitoring
 */
export default async function main() {
  state.stats.startTime = new Date();

  // Deep clean is enabled by default
  // Set CLEAN_DEEP=false to disable
  const isExplicitlyDisabled =
    process.env.CLEAN_DEEP === 'false' || process.argv.includes('--deep=false');
  const enableDeepClean = !isExplicitlyDisabled;

  // Dry run mode - only show what would be deleted
  const isDryRun = process.env.CLEAN_DRY_RUN === 'true';

  // Preservation settings
  const preserveGit = process.env.CLEAN_PRESERVE_GIT !== 'false';
  const maxAge =
    parseInt(process.env.CLEAN_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000; // 7 days

  logInfo(`🧹 Starting enhanced cleanup operation...`);

  if (isDryRun) {
    logWarn(`🔍 DRY RUN MODE: No files will actually be deleted`);
  }

  logVerbose(`Configuration: ${JSON.stringify(config, null, 2)}`);

  try {
    // Define cleaning targets with priorities
    const cleaningTargets = [
      {
        name: 'Build directory',
        path: config.BUILD_DIR,
        priority: 1,
        options: {},
        description: 'Remove build artifacts and compiled files',
      },
      {
        name: 'Cache directory',
        path: path.resolve(config.CWD, '.cache'),
        priority: 2,
        options: {},
        description: 'Clear build and compilation caches',
        condition: () => enableDeepClean,
      },
      {
        name: 'Temporary files',
        path: path.resolve(config.CWD, 'tmp'),
        priority: 3,
        options: {},
        description: 'Remove temporary files and directories',
        condition: () => enableDeepClean,
      },
    ];

    // Filter targets based on conditions
    const activeTargets = cleaningTargets.filter(
      target => !target.condition || target.condition(),
    );

    // Sort by priority
    activeTargets.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    logInfo(`Cleaning ${activeTargets.length} target locations...`);

    // Execute cleaning operations
    const results = [];

    // eslint-disable-next-line no-restricted-syntax, no-unused-vars
    for (const target of activeTargets) {
      const targetStart = Date.now();

      try {
        logDebug(`Starting: ${target.name} (${target.path})`);

        // eslint-disable-next-line no-await-in-loop
        const result = await withFileSystemRetry(
          () =>
            enhancedCleanDir(target.path, {
              ...target.options,
              preserveGit,
              maxAge,
              isDryRun,
            }),
          {
            operation: `clean-${target.name
              .toLowerCase()
              .replace(/\s+/g, '-')}`,
            targetPath: target.path,
          },
        );

        const targetDuration = Date.now() - targetStart;

        if (result.error) {
          logWarn(`❌ ${target.name}: ${result.message}`);
        } else if (result.preserved) {
          logVerbose(`🔒 ${target.name}: ${result.reason}`);
        } else if (result.dryRun) {
          logInfo(`🔍 ${target.name}: Would free ${formatBytes(result.size)}`);
        } else if (result.skipped) {
          logVerbose(`⏭️  ${target.name}: ${result.reason}`);
        } else {
          const sizeInfo = result.size ? ` (${formatBytes(result.size)})` : '';
          logVerbose(
            `✅ ${target.name}: Cleaned in ${targetDuration}ms${sizeInfo}`,
          );
        }

        results.push({
          name: target.name,
          path: target.path,
          duration: targetDuration,
          ...result,
        });
      } catch (error) {
        const targetError = new BuildError(
          `Failed to clean ${target.name}: ${error.message}`,
          {
            targetName: target.name,
            targetPath: target.path,
            originalError: error.message,
          },
        );

        logDetailedError(targetError, { operation: 'clean-target' });
        // eslint-disable-next-line no-plusplus
        state.stats.errors++;

        results.push({
          name: target.name,
          path: target.path,
          error: true,
          message: error.message,
        });
      }
    }

    // Calculate final statistics
    state.stats.endTime = new Date();
    const stats = getCleanStats();

    // Report results
    const errorCount = results.filter(r => r.error).length;
    const preservedCount = results.filter(r => r.preserved).length;

    if (isDryRun) {
      logInfo(
        `🔍 DRY RUN COMPLETE: Would free ${formatBytes(
          stats.totalSize,
        )} in ${Math.round(stats.duration)}ms`,
      );
    } else if (errorCount === 0) {
      logInfo(
        `✅ Cleanup completed successfully in ${Math.round(stats.duration)}ms`,
      );

      if (
        stats.freedSpace > 0 ||
        stats.deletedFiles > 0 ||
        stats.deletedDirectories > 0
      ) {
        logInfo(`   🗑️  Freed space: ${formatBytes(stats.freedSpace)}`);
        logInfo(
          `   📁 Cleaned: ${stats.deletedDirectories} directories, ${stats.deletedFiles} files`,
        );
      } else {
        logInfo(`   📁 No files to clean (directory already empty)`);
      }

      if (preservedCount > 0) {
        logInfo(`   🔒 Preserved: ${stats.preservedItems} items`);
      }
    } else {
      logWarn(
        `⚠️ Cleanup completed with ${errorCount} errors in ${Math.round(
          stats.duration,
        )}ms`,
      );
      logInfo(`   🗑️  Freed space: ${formatBytes(stats.freedSpace)}`);
    }

    if (isVerbose()) {
      const performanceMetrics = [
        `Performance metrics:`,
        `   Efficiency: ${stats.efficiency.toFixed(1)}%`,
        `   Average per target: ${Math.round(
          stats.duration / activeTargets.length,
        )}ms`,
      ];

      if (stats.freedSpace > 0) {
        performanceMetrics.push(
          `   Cleanup rate: ${formatBytes(
            stats.freedSpace / (stats.duration / 1000),
          )}/s`,
        );
      }

      logVerbose(performanceMetrics.join('\n'));
    }

    return {
      success: errorCount === 0,
      stats,
      results,
      dryRun: isDryRun,
    };
  } catch (error) {
    state.stats.endTime = new Date();
    // eslint-disable-next-line no-plusplus
    state.stats.errors++;

    const cleanError =
      error instanceof BuildError
        ? error
        : new BuildError(`Clean operation failed: ${error.message}`, {
            originalError: error.message,
            stats: getCleanStats(),
          });

    logDetailedError(cleanError, { operation: 'clean' });
    throw cleanError;
  }
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
