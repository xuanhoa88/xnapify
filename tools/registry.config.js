/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

const config = require('./config');

// Eagerly scan apps and extensions for overriding tool configurations
// Using synchronous discovery to ensure config is available at startup
// before Webpack/Babel/ESLint initialization blocks

const discoveryRoots = [
  path.join(config.APP_DIR, 'apps'),
  path.join(config.APP_DIR, 'extensions'),
];

const registry = {
  webpackConfigs: [],
  postcssConfigs: [],
  babelConfigs: [],
  eslintConfigs: [],
};

function scanRoot(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  const dirs = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const dirent of dirs) {
    const targetPath = path.join(rootDir, dirent.name);
    // Support symlinks pointing to directories (monorepo workspaces / npm link)
    const isDir =
      dirent.isDirectory() ||
      (dirent.isSymbolicLink() && fs.statSync(targetPath).isDirectory());

    if (!isDir) continue;

    // Support scope packages eg @xnapify-extension/quick-access
    if (dirent.name.startsWith('@')) {
      const scopeDir = targetPath;
      let subDirs;
      try {
        subDirs = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch (err) {
        continue;
      }
      for (const subDirent of subDirs) {
        const subTargetPath = path.join(scopeDir, subDirent.name);
        const isSubDir =
          subDirent.isDirectory() ||
          (subDirent.isSymbolicLink() &&
            fs.statSync(subTargetPath).isDirectory());

        if (isSubDir) {
          checkAndRegister(subTargetPath);
        }
      }
    } else {
      checkAndRegister(targetPath);
    }
  }
}

function checkAndRegister(moduleDir) {
  // Defensive validation: Ensure it's a structural module before registering tools.
  if (!fs.existsSync(path.join(moduleDir, 'package.json'))) {
    return;
  }
  // Webpack: search for module.webpack.js or extension.webpack.js
  const webpackCustomizers = ['module.webpack.js', 'extension.webpack.js'];
  for (const name of webpackCustomizers) {
    const filePath = path.join(moduleDir, name);
    if (fs.existsSync(filePath)) {
      registry.webpackConfigs.push({ moduleDir, path: filePath });
      break;
    }
  }

  // PostCSS: module.postcss.js or postcss.config.js
  const postcssCustomizers = ['module.postcss.js', 'postcss.config.js'];
  for (const name of postcssCustomizers) {
    const filePath = path.join(moduleDir, name);
    if (fs.existsSync(filePath)) {
      registry.postcssConfigs.push({ moduleDir, path: filePath });
      break;
    }
  }

  // Babel: module.babel.js, babel.config.js, .babelrc.js, .babelrc.json, .babelrc
  const babelCustomizers = [
    'module.babel.js',
    'babel.config.js',
    '.babelrc.js',
    '.babelrc.json',
    '.babelrc',
  ];
  for (const name of babelCustomizers) {
    const filePath = path.join(moduleDir, name);
    if (fs.existsSync(filePath)) {
      registry.babelConfigs.push({ moduleDir, path: filePath });
      break;
    }
  }

  // ESLint: module.eslint.js or .eslintrc.js
  const eslintCustomizers = [
    'module.eslint.js',
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc',
  ];
  for (const name of eslintCustomizers) {
    const filePath = path.join(moduleDir, name);
    if (fs.existsSync(filePath)) {
      registry.eslintConfigs.push({ moduleDir, path: filePath });
      break;
    }
  }
}

// Perform scan at boot time
discoveryRoots.forEach(scanRoot);

module.exports = registry;
