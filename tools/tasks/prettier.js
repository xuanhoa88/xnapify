#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Prettier Formatting Script
 *
 * This script reads file patterns from .prettierrc.js and runs prettier.
 * This allows patterns to be centralized in the config file instead of
 * being hardcoded in package.json.
 *
 * Usage:
 *   node tools/prettier              # Format all files
 *   node tools/prettier --check      # Check formatting
 *   node tools/prettier code         # Format only code files
 *   node tools/prettier styles       # Format only style files
 */

import fs from 'fs';
import { format as prettierFormatter } from 'prettier';
import prettierConfig from '../../.prettierrc';
import config from '../config';
import { readDir } from '../lib/fs';
import { logError, logInfo, logWarn } from '../lib/logger';

/**
 * Main prettier formatting function
 * Export as default for task runner compatibility
 */
export default async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const patternName = args.find(arg => !arg.startsWith('--')) || 'all';

  // Get the pattern to use
  const pattern =
    prettierConfig.patterns[patternName] || prettierConfig.patterns.all;

  // Log what we're doing
  logInfo(`📝 ${isCheck ? 'Checking' : 'Formatting'} files: ${pattern}`);

  // Get all files matching the pattern
  const files = await readDir(pattern, {
    cwd: config.CWD,
  });

  if (files.length === 0) {
    logWarn('⚠️ No files found matching pattern');
    return;
  }

  logInfo(`Found ${files.length} files to ${isCheck ? 'check' : 'format'}`);

  let hasErrors = false;
  let formattedCount = 0;
  let unchangedCount = 0;

  // Process each file
  files.forEach(file => {
    const filePath = config.resolve(file);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    try {
      // Check if file is formatted
      const formatted = prettierFormatter(fileContent, {
        ...prettierConfig,
        filepath: filePath,
      });

      if (isCheck) {
        // Check mode: verify if file is already formatted
        if (fileContent !== formatted) {
          logError(`❌ ${file}`);
          hasErrors = true;
        } else {
          unchangedCount += 1;
        }
      } else {
        // Write mode: format the file
        // eslint-disable-next-line no-lonely-if
        if (fileContent !== formatted) {
          fs.writeFileSync(filePath, formatted, 'utf8');
          logInfo(`✅ ${file}`);
          formattedCount += 1;
        } else {
          unchangedCount += 1;
        }
      }
    } catch (error) {
      logError(`❌ Error processing ${file}: ${error.message}`);
      hasErrors = true;
    }
  });

  // Summary
  if (isCheck) {
    if (hasErrors) {
      throw new Error('Format check failed! Some files need formatting.');
    }
    logInfo(`✅ All ${files.length} files are properly formatted!`);
    return;
  }

  // Write mode summary
  logInfo(`✅ Formatted ${formattedCount} files, ${unchangedCount} unchanged`);

  if (hasErrors) {
    throw new Error('Prettier formatting failed');
  }
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
