/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');

// Get environment variable with default fallback
const env = (key, defaultValue) => {
  const value = process.env[key];
  return value != null ? value : defaultValue;
};

// Project root directory (overridable via CWD env var)
const CWD = (() => {
  const rootEnv = env('CWD');
  if (!rootEnv) return process.cwd();
  return path.isAbsolute(rootEnv)
    ? rootEnv
    : path.resolve(process.cwd(), rootEnv);
})();

// Resolve path from project root
const resolve = (...args) => path.resolve(CWD, ...args);

// Resolve directory with env var override support
const getDirFromEnv = (envVar, defaultPath) => {
  const envValue = env(envVar);
  if (!envValue) return resolve(defaultPath);
  return path.isAbsolute(envValue) ? envValue : resolve(envValue);
};

const BUILD_DIR = getDirFromEnv('BUILD_DIR', 'build');
const APP_DIR = getDirFromEnv('APP_DIR', 'src');
const PUBLIC_DIR = getDirFromEnv('PUBLIC_DIR', 'public');
const NODE_MODULES_DIR = getDirFromEnv('NODE_MODULES_DIR', 'node_modules');

module.exports = {
  // Helpers
  env,
  resolve,
  CWD,

  // Directories
  BUILD_DIR,
  APP_DIR,
  PUBLIC_DIR,
  NODE_MODULES_DIR,

  // Shared bundle config
  bundleAnalyze: env('BUNDLE_ANALYZE') === 'true',
  bundleMaxAssetSize: parseInt(env('BUNDLE_MAX_ASSET_SIZE'), 10) || 250000, // 250KB
};
