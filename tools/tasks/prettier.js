#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const { format: prettierFormatter } = require('prettier');
const prettierConfig = require('../../.prettierrc');
const config = require('../config');
const { readDir, writeFile } = require('../utils/fs');
const {
  formatDuration,
  isSilent,
  isVerbose,
  logDebug,
  logInfo,
  logWarn,
} = require('../utils/logger');

// File extensions to format
const FORMATTABLE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.scss',
  '.md',
];

// Directories to exclude
const EXCLUDED_DIRS = ['node_modules', 'build', 'coverage', '.git', '.cache'];

/**
 * Recursively find files to format
 * @param {string} dir - Directory to scan
 * @returns {Promise<string[]>} - Array of file paths
 */
async function findFiles(dir) {
  const files = [];
  const entries = await readDir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`;

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name)) {
        // eslint-disable-next-line no-await-in-loop
        const subFiles = await findFiles(fullPath);
        files.push(...subFiles);
      }
    } else if (entry.isFile()) {
      const ext = entry.name.substring(entry.name.lastIndexOf('.'));
      if (FORMATTABLE_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Get parser for file extension
 * @param {string} ext - File extension
 * @returns {string} - Prettier parser name
 */
function getParser(ext) {
  const parsers = {
    '.js': 'babel',
    '.jsx': 'babel',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.css': 'css',
    '.scss': 'scss',
    '.md': 'markdown',
  };
  return parsers[ext] || 'babel';
}

/**
 * Format a single file
 * @param {string} filePath - Path to file
 * @param {Object} options - Prettier options
 * @returns {Promise<{path: string, formatted: boolean, error?: string}>}
 */
async function formatFile(filePath, options) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const parser = getParser(ext);

    const formatted = await prettierFormatter(content, {
      ...options,
      parser,
      filepath: filePath,
    });

    if (content !== formatted) {
      await writeFile(filePath, formatted);
      logDebug(`Formatted: ${filePath}`);
      return { path: filePath, formatted: true };
    }

    return { path: filePath, formatted: false };
  } catch (error) {
    return { path: filePath, formatted: false, error: error.message };
  }
}

/**
 * Main prettier task
 */
async function main() {
  const startTime = Date.now();
  const silent = isSilent();
  const verbose = isVerbose();

  if (!silent) {
    logInfo('💅 Running Prettier...');
  }

  try {
    // Get target directory or pattern from args
    const targetArg = process.argv[2];
    const targetDirs = targetArg
      ? [targetArg]
      : [config.APP_DIR, require('path').resolve(config.CWD, 'shared')];

    // Check if it's a --check mode (no modifications)
    const checkOnly = process.argv.includes('--check');

    if (checkOnly) {
      logInfo('🔍 Check mode: No files will be modified');
    }

    // Find all formattable files
    const files = [];
    for (const dir of targetDirs) {
      files.push(...(await findFiles(dir)));
    }

    if (verbose) {
      logInfo(`📂 Found ${files.length} files to process`);
    }

    // Format files
    const results = [];
    for (const filePath of files) {
      if (checkOnly) {
        // In check mode, just verify formatting
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const ext = filePath.substring(filePath.lastIndexOf('.'));
          const parser = getParser(ext);

          // eslint-disable-next-line no-await-in-loop
          const formatted = await prettierFormatter(content, {
            ...prettierConfig,
            parser,
            filepath: filePath,
          });

          if (content !== formatted) {
            results.push({
              path: filePath,
              formatted: false,
              needsFormatting: true,
            });
          } else {
            results.push({ path: filePath, formatted: true });
          }
        } catch (error) {
          results.push({
            path: filePath,
            formatted: false,
            error: error.message,
          });
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        const result = await formatFile(filePath, prettierConfig);
        results.push(result);
      }
    }

    // Collect stats
    const changedCount = results.filter(
      r => r.formatted === true && checkOnly !== true,
    ).length;
    const needsFormattingCount = results.filter(r => r.needsFormatting).length;
    const errorCount = results.filter(r => r.error).length;

    // Report results
    const duration = Date.now() - startTime;

    if (!silent) {
      logInfo(`✅ Prettier completed in ${formatDuration(duration)}`);
      logInfo(`   📁 Files processed: ${files.length}`);

      if (checkOnly) {
        if (needsFormattingCount > 0) {
          logWarn(`   ⚠️ Files need formatting: ${needsFormattingCount}`);
          if (verbose) {
            results
              .filter(r => r.needsFormatting)
              .slice(0, 10)
              .forEach(r => logWarn(`      • ${r.path}`));
            if (needsFormattingCount > 10) {
              logWarn(`      ... and ${needsFormattingCount - 10} more`);
            }
          }
        } else {
          logInfo(`   ✨ All files are properly formatted`);
        }
      } else {
        logInfo(`   ✨ Files formatted: ${changedCount}`);
      }

      if (errorCount > 0) {
        logWarn(`   ❌ Errors: ${errorCount}`);
        if (verbose) {
          results
            .filter(r => r.error)
            .forEach(r => logWarn(`      • ${r.path}: ${r.error}`));
        }
      }
    }

    // Exit with error in check mode if files need formatting
    if (checkOnly && needsFormattingCount > 0) {
      process.exitCode = 1;
    }

    return {
      success:
        errorCount === 0 && (checkOnly ? needsFormattingCount === 0 : true),
      filesProcessed: files.length,
      filesFormatted: changedCount,
      filesNeedFormatting: needsFormattingCount,
      errors: errorCount,
      duration,
    };
  } catch (error) {
    logWarn(`❌ Prettier failed: ${error.message}`);
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

module.exports = main;
