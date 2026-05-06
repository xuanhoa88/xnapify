/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import config from '../config.js';

// Eagerly scan apps and extensions for overriding tool configurations
// Using synchronous discovery to ensure config is available at startup
// before rspack/ESLint initialization blocks

const discoveryRoots = [
  path.join(config.APP_DIR, 'apps'),
  path.join(config.APP_DIR, 'extensions'),
];

const registry = {
  rspackConfigs: [],
  postcssConfigs: [],
  eslintConfigs: [],
  stylelintConfigs: [],
};

// Customizer file names, checked in priority order (first match wins).
// Hoisted to module scope to avoid re-allocation per module.
const CUSTOMIZERS = {
  rspack: ['module.rspack.js', 'extension.rspack.js'],
  postcss: ['module.postcss.js', 'postcss.config.js'],
  eslint: ['module.eslint.js', '.eslintrc.js', '.eslintrc.json', '.eslintrc'],
  stylelint: [
    'module.stylelint.js',
    '.stylelintrc.js',
    '.stylelintrc.json',
    '.stylelintrc',
  ],
};

/**
 * Check if a directory entry should be skipped during scanning.
 * Skips hidden directories (.) and route-group directories like (default).
 *
 * @param {string} name - Directory name
 * @returns {boolean} - true if the directory should be skipped
 */
function shouldSkip(name) {
  return name.startsWith('.') || name.startsWith('(');
}

/**
 * Resolve whether a dirent is a directory, following symlinks if needed.
 *
 * @param {fs.Dirent} dirent - Directory entry
 * @param {string} fullPath - Absolute path to the entry
 * @returns {boolean}
 */
function isDirectory(dirent, fullPath) {
  return (
    dirent.isDirectory() ||
    (dirent.isSymbolicLink() && fs.statSync(fullPath).isDirectory())
  );
}

function scanRoot(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  const dirs = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const dirent of dirs) {
    const targetPath = path.join(rootDir, dirent.name);
    if (!isDirectory(dirent, targetPath)) continue;
    if (shouldSkip(dirent.name)) continue;

    // Support scoped packages eg @xnapify-extension/quick-access
    if (dirent.name.startsWith('@')) {
      let subDirs;
      try {
        subDirs = fs.readdirSync(targetPath, { withFileTypes: true });
      } catch (_err) {
        continue;
      }
      for (const subDirent of subDirs) {
        const subTargetPath = path.join(targetPath, subDirent.name);
        if (!isDirectory(subDirent, subTargetPath)) continue;
        if (shouldSkip(subDirent.name)) continue;
        checkAndRegister(subTargetPath);
      }
    } else {
      checkAndRegister(targetPath);
    }
  }
}

function checkAndRegister(moduleDir) {
  // Read the module directory once to get all files, then match
  // against known customizer names in memory. This replaces up to
  // 14 individual existsSync calls with a single readdirSync.
  let files;
  try {
    files = new Set(fs.readdirSync(moduleDir));
  } catch (_err) {
    return;
  }

  // Defensive validation: Ensure it's a structural module before registering tools.
  if (!files.has('package.json')) {
    return;
  }

  // rspack: search for module.rspack.js or extension.rspack.js
  for (const name of CUSTOMIZERS.rspack) {
    if (files.has(name)) {
      registry.rspackConfigs.push({
        moduleDir,
        path: path.join(moduleDir, name),
      });
      break;
    }
  }

  // PostCSS: module.postcss.js or postcss.config.js
  for (const name of CUSTOMIZERS.postcss) {
    if (files.has(name)) {
      registry.postcssConfigs.push({
        moduleDir,
        path: path.join(moduleDir, name),
      });
      break;
    }
  }

  // ESLint: module.eslint.js, .eslintrc.js, .eslintrc.json, .eslintrc
  for (const name of CUSTOMIZERS.eslint) {
    if (files.has(name)) {
      registry.eslintConfigs.push({
        moduleDir,
        path: path.join(moduleDir, name),
      });
      break;
    }
  }

  // Stylelint: module.stylelint.js, .stylelintrc.js, .stylelintrc.json, .stylelintrc
  for (const name of CUSTOMIZERS.stylelint) {
    if (files.has(name)) {
      registry.stylelintConfigs.push({
        moduleDir,
        path: path.join(moduleDir, name),
      });
      break;
    }
  }
}

// Perform scan at boot time
discoveryRoots.forEach(scanRoot);

export const { rspackConfigs } = registry;
export const { postcssConfigs } = registry;
export const { eslintConfigs } = registry;
export const { stylelintConfigs } = registry;
