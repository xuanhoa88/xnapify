#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import config from '../config';
import { BuildError, withFileSystemRetry } from '../lib/errorHandler';
import { ensureDir, readDir, readFile, writeFile } from '../lib/fs';
import {
  isVerbose,
  logDebug,
  logError,
  logInfo,
  logVerbose,
  logWarn,
} from '../lib/logger';

// i18n configuration
const I18N_TRANSLATIONS_DIR = path.join(config.APP_DIR, 'i18n', 'translations');
const I18N_SOURCE_EXTENSIONS = config.env(
  'I18N_SOURCE_EXTENSIONS',
  '.js,.jsx,.ts,.tsx',
);
const I18N_VALIDATE = config.env('I18N_VALIDATE') !== 'false';
const I18N_BACKUP = config.env('I18N_BACKUP') !== 'false';

const state = {
  extractedKeys: new Set(), // All unique keys found in source
  keyUsage: new Map(), // key -> Set of file paths
  translations: new Map(), // locale -> nested object
  processedFiles: new Set(),
  errors: [], // Array of {fileName, error} objects
  warnings: [], // Array of warning messages
  stats: {
    totalFiles: 0,
    processedFiles: 0,
    extractedKeys: 0,
    errors: 0,
    warnings: 0,
    startTime: null,
    endTime: null,
  },
};

/**
 * Convert dot-notation key to nested object
 * @param {string} key - Dot-notation key (e.g., 'header.brand')
 * @param {string} value - Translation value
 * @returns {Object} Nested object
 */
function keyToNestedObject(key, value) {
  const parts = key.split('.');
  const result = {};
  let current = result;

  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
    } else {
      current[part] = current[part] || {};
      current = current[part];
    }
  });

  return result;
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  Object.keys(source).forEach(key => {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  });

  return result;
}

/**
 * Flatten nested object to dot-notation keys
 * @param {Object} obj - Nested object
 * @param {string} prefix - Key prefix
 * @returns {Object} Flat object with dot-notation keys
 */
function flattenObject(obj, prefix = '') {
  const result = {};

  Object.keys(obj).forEach(key => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  });

  return result;
}

/**
 * Sort object keys recursively
 * @param {Object} obj - Object to sort
 * @returns {Object} Sorted object
 */
function sortObjectKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach(key => {
      sorted[key] = sortObjectKeys(obj[key]);
    });

  return sorted;
}

/**
 * Recursively find files with specific extensions
 * @param {string} dir - Directory to search
 * @param {string[]} extensions - File extensions to match (e.g., ['.js', '.jsx'])
 * @returns {Promise<string[]>} Array of file paths
 */
async function findFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
  const files = [];

  async function scan(currentDir) {
    try {
      const entries = await withFileSystemRetry(
        () => readDir(currentDir, { withFileTypes: true }),
        { operation: 'scan-directory' },
      );

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, build, coverage, etc.
          if (
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules' &&
            entry.name !== 'build' &&
            entry.name !== 'coverage' &&
            entry.name !== 'dist'
          ) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logWarn(`Failed to scan directory ${currentDir}: ${error.message}`);
    }
  }

  await scan(dir);
  return files;
}

/**
 * Extract translation keys from source code
 * Looks for t('key') and t("key") patterns
 * @param {string} code - Source code
 * @param {string} fileName - File name for error reporting
 * @returns {Set<string>} Set of extracted keys
 */
function extractTranslationKeys(code, fileName) {
  const keys = new Set();

  // Match t('key') and t("key") patterns
  // Supports:
  // - t('simple.key')
  // - t("simple.key")
  // - t('key.with.dots')
  // Does NOT support:
  // - t(`template.${variable}`) - dynamic keys should be avoided
  const patterns = [
    /\bt\(['"]([^'"]+)['"]\)/g, // t('key') or t("key")
  ];

  patterns.forEach(pattern => {
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(code)) !== null) {
      const key = match[1].trim();
      if (key) {
        keys.add(key);
      }
    }
  });

  // Check for template literals (not supported)
  const templatePattern = /\bt\(`([^`]+)`\)/g;
  let templateMatch;
  // eslint-disable-next-line no-cond-assign
  while ((templateMatch = templatePattern.exec(code)) !== null) {
    const warning = `Dynamic key in ${path.basename(fileName)}: t(\`${
      templateMatch[1]
    }\`) - use static keys instead`;
    if (!state.warnings.includes(warning)) {
      state.warnings.push(warning);
      logWarn(warning);
      state.stats.warnings++;
    }
  }

  return keys;
}

/**
 * Process a single source file
 * @param {string} fileName - File path
 * @returns {Promise<number>} Number of keys extracted
 */
async function processFile(fileName) {
  try {
    const code = await withFileSystemRetry(() => readFile(fileName), {
      operation: 'read-source-file',
      context: { fileName },
    });

    const keys = extractTranslationKeys(code, fileName);

    if (keys.size > 0) {
      keys.forEach(key => {
        state.extractedKeys.add(key);

        // Track key usage with Set for better performance
        if (!state.keyUsage.has(key)) {
          state.keyUsage.set(key, new Set());
        }
        state.keyUsage.get(key).add(fileName);
      });

      logDebug(`Found ${keys.size} keys in ${path.basename(fileName)}`);
    }

    state.processedFiles.add(fileName);
    state.stats.processedFiles++;
    return keys.size;
  } catch (error) {
    const fileError = new BuildError(`Failed to process ${fileName}`, {
      originalError: error.message,
      fileName,
    });
    state.errors.push({ fileName, error: fileError });
    state.stats.errors++;
    logWarn(`⚠️ ${fileError.message}`);
    return 0;
  }
}

/**
 * Load existing translation file
 * @param {string} locale - Locale code (e.g., 'en-US')
 * @returns {Object} Translation object (nested)
 */
async function loadTranslationFile(locale) {
  const filePath = path.join(I18N_TRANSLATIONS_DIR, `${locale}.json`);

  try {
    const content = await readFile(filePath, 'utf8');
    const translations = JSON.parse(content);
    logDebug(`Loaded ${locale} translations from ${filePath}`);
    return translations;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logWarn(`Translation file not found: ${filePath}, will create new`);
      return {};
    }
    throw new BuildError(`Failed to load translation file: ${filePath}`, {
      locale,
      error: error.message,
    });
  }
}

/**
 * Save translation file
 * @param {string} locale - Locale code
 * @param {Object} translations - Translation object (nested)
 */
async function saveTranslationFile(locale, translations) {
  const filePath = path.join(I18N_TRANSLATIONS_DIR, `${locale}.json`);

  try {
    // Create backup if enabled
    if (I18N_BACKUP) {
      try {
        const existingContent = await readFile(filePath, 'utf8');
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await writeFile(backupPath, existingContent);
        logDebug(`Created backup: ${backupPath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logWarn(`Failed to create backup for ${locale}: ${error.message}`);
        }
      }
    }

    // Sort keys for consistent output
    const sorted = sortObjectKeys(translations);

    // Write file
    const content = `${JSON.stringify(sorted, null, 2)}\n`;
    await withFileSystemRetry(() => writeFile(filePath, content), {
      operation: 'write-translation-file',
    });

    logVerbose(`💾 Saved ${locale} translations to ${filePath}`);
  } catch (error) {
    throw new BuildError(`Failed to save translation file: ${filePath}`, {
      locale,
      error: error.message,
    });
  }
}

/**
 * Get all locale files
 * @returns {string[]} Array of locale codes
 */
async function getLocales() {
  try {
    const files = await readDir(I18N_TRANSLATIONS_DIR);
    const locales = files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));

    logDebug(`Found ${locales.length} locale files: ${locales.join(', ')}`);
    return locales;
  } catch (error) {
    throw new BuildError('Failed to read translations directory', {
      dir: I18N_TRANSLATIONS_DIR,
      error: error.message,
    });
  }
}

/**
 * Sync keys across all translation files
 * Adds missing keys with placeholder values
 * @returns {Object} Sync results
 */
async function syncTranslationKeys() {
  const locales = await getLocales();
  const results = {
    locales: [],
    addedKeys: new Map(), // locale -> [keys]
    missingKeys: new Map(), // locale -> [keys]
  };

  logInfo(
    `🔄 Syncing ${state.extractedKeys.size} keys across ${locales.length} locales...`,
  );

  for (const locale of locales) {
    const translations = await loadTranslationFile(locale);
    const flatTranslations = flattenObject(translations);
    const addedKeys = [];
    const missingKeys = [];

    // Check for missing keys
    state.extractedKeys.forEach(key => {
      if (!(key in flatTranslations)) {
        // Add missing key with placeholder
        const placeholder = `[${locale}] ${key}`;
        const nested = keyToNestedObject(key, placeholder);
        Object.assign(translations, deepMerge(translations, nested));
        addedKeys.push(key);
        missingKeys.push(key);
      }
    });

    // Validate existing keys
    if (I18N_VALIDATE) {
      Object.keys(flatTranslations).forEach(key => {
        if (!state.extractedKeys.has(key)) {
          logWarn(`⚠️ Unused key in ${locale}: ${key}`);
          state.stats.warnings++;
        }
      });
    }

    // Save updated translations
    if (addedKeys.length > 0) {
      await saveTranslationFile(locale, translations);
      logInfo(`   ✅ ${locale}: Added ${addedKeys.length} missing keys`);
    } else {
      logVerbose(`   ✅ ${locale}: All keys present`);
    }

    results.locales.push(locale);
    results.addedKeys.set(locale, addedKeys);
    results.missingKeys.set(locale, missingKeys);
  }

  return results;
}

/**
 * Get processing statistics
 * @returns {Object} Statistics
 */
function getProcessingStats() {
  return {
    totalFiles: state.stats.totalFiles,
    processedFiles: state.stats.processedFiles,
    extractedKeys: state.extractedKeys.size,
    filesWithKeys: state.keyUsage.size,
    errors: state.stats.errors,
    warnings: state.stats.warnings,
    startTime: state.stats.startTime,
  };
}

/**
 * Print detailed statistics
 * @param {Object} syncResults - Sync results
 */
function printStatistics(syncResults) {
  const verbose = isVerbose(); // Cache verbose check
  const stats = getProcessingStats();

  // Calculate total new keys added across all locales
  let totalNewKeys = 0;
  syncResults.addedKeys.forEach(keys => {
    totalNewKeys += keys.length;
  });

  const statistics = [
    '\n📊 Statistics:',
    `   Files processed: ${stats.processedFiles}/${stats.totalFiles}`,
    `   Unique keys: ${stats.extractedKeys}`,
    `   Locales: ${syncResults.locales.length}`,
    ...(totalNewKeys > 0 ? [`   New keys added: ${totalNewKeys}`] : []),
  ].join('\n');

  logInfo(statistics);

  if (state.warnings.length > 0) {
    const warningMessage = [`   Warnings: ${state.warnings.length}`];

    if (verbose) {
      state.warnings.forEach(warning => {
        warningMessage.push(`     - ${warning}`);
      });
    }

    logWarn(warningMessage.join('\n'));
  }

  if (state.errors.length > 0) {
    const errorMessage = [`   Errors: ${state.errors.length}`];

    if (verbose) {
      state.errors.forEach(({ fileName, error }) => {
        errorMessage.push(
          `     - ${path.basename(fileName)}: ${error.message}`,
        );
      });
    }

    logWarn(errorMessage.join('\n'));
  }

  // Show most used keys in verbose mode
  if (verbose && state.keyUsage.size > 0) {
    const sortedKeys = Array.from(state.keyUsage.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10);

    const keysList = sortedKeys.map(
      ([key, files]) => `   ${key}: ${files.size} file(s)`,
    );

    if (state.keyUsage.size > 10) {
      keysList.push(`   ... and ${state.keyUsage.size - 10} more keys`);
    }

    logVerbose(`\n🔑 Most used keys:\n${keysList.join('\n')}`);
  }

  // Show locale details in debug mode
  const localeDetails = syncResults.locales
    .map(
      ({ locale, addedKeys, totalKeys }) =>
        `   ${locale}: ${totalKeys} keys (${addedKeys} new)`,
    )
    .join('\n');

  logDebug(`\n🌍 Locale details:\n${localeDetails}`);
}

/**
 * Validate extracted keys for common issues
 * @returns {Object} Validation results
 */
function validateKeys() {
  const issues = [];

  if (!I18N_VALIDATE) {
    return { valid: true, issues: [] };
  }

  // Check for keys that might be too generic
  const genericKeys = ['title', 'description', 'name', 'label', 'button'];
  state.extractedKeys.forEach(key => {
    if (genericKeys.includes(key)) {
      issues.push({
        type: 'warning',
        key,
        message: `Generic key '${key}' should be namespaced (e.g., 'page.title')`,
      });
    }
  });

  // Check for very long keys
  state.extractedKeys.forEach(key => {
    if (key.length > 100) {
      issues.push({
        type: 'warning',
        key,
        message: `Key '${key}' is very long (${key.length} chars)`,
      });
    }
  });

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
  };
}

/**
 * Main i18n key extraction and synchronization
 */
export default async function main() {
  const startTime = Date.now();

  try {
    state.stats.startTime = new Date();

    logInfo('🌍 Starting i18n key extraction (react-i18next)...');
    logDebug(
      `Source directory: ${config.APP_DIR}\n` +
        `Source extensions: ${I18N_SOURCE_EXTENSIONS}\n` +
        `Translations dir: ${I18N_TRANSLATIONS_DIR}`,
    );

    // Parse extensions string into array
    const extensions = I18N_SOURCE_EXTENSIONS.split(',').map(ext => ext.trim());

    // Ensure translations directory exists
    await withFileSystemRetry(() => ensureDir(I18N_TRANSLATIONS_DIR), {
      operation: 'create-translations-dir',
    });

    // Find all source files
    logInfo('📂 Scanning source files...');

    const files = await findFiles(config.APP_DIR, extensions);

    if (files.length === 0) {
      logWarn(`No files found in directory: ${config.APP_DIR}`);
      return { success: false, error: 'No source files found' };
    }

    state.stats.totalFiles = files.length;
    logInfo(`Found ${files.length} source files`);

    // Process all files
    logInfo('🔍 Extracting translation keys...');
    const processingStart = Date.now();

    for (const file of files) {
      await processFile(file);
    }

    const processingDuration = Date.now() - processingStart;
    logInfo(
      `✅ Processed ${state.stats.processedFiles} files in ${processingDuration}ms`,
    );
    logInfo(`📝 Extracted ${state.extractedKeys.size} unique translation keys`);

    // Sync keys across all translation files
    const syncResults = await syncTranslationKeys();

    // Validate keys
    const validation = validateKeys();
    if (validation.issues.length > 0) {
      const validationMessage = [
        `\n⚠️ Found ${validation.issues.length} validation issue(s):`,
        ...validation.issues.map(
          issue => `   ${issue.type.toUpperCase()}: ${issue.message}`,
        ),
      ];

      logWarn(validationMessage.join('\n'));
    }

    // Print statistics
    state.stats.endTime = new Date();
    const totalDuration = Date.now() - startTime;
    logInfo(`\n✅ i18n extraction completed in ${totalDuration}ms`);
    printStatistics(syncResults);

    return {
      success: true,
      stats: getProcessingStats(),
      duration: totalDuration,
      syncResults,
    };
  } catch (error) {
    const extractError =
      error instanceof BuildError
        ? error
        : new BuildError(`i18n extraction failed: ${error.message}`, {
            originalError: error.message,
            stats: getProcessingStats(),
          });

    logError(extractError, { operation: 'i18n-extraction' });
    throw extractError;
  }
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
