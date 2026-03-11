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
const getCwd = () => {
  const rootEnv = env('CWD');
  if (!rootEnv) return process.cwd();
  return path.isAbsolute(rootEnv)
    ? rootEnv
    : path.resolve(process.cwd(), rootEnv);
};

// Resolve path from project root
const resolvePath = (...args) => path.resolve(getCwd(), ...args);

// Resolve directory with env var override support
const getDirFromEnv = (envVar, defaultPath) => {
  const envValue = env(envVar);
  if (!envValue) return resolvePath(defaultPath);
  return path.isAbsolute(envValue) ? envValue : resolvePath(envValue);
};

module.exports = {
  // Helpers
  env,

  // Dynamic getters so process.env changes are reflected
  // after dotenv-flow initializes
  get CWD() {
    return getCwd();
  },

  get BUILD_DIR() {
    return getDirFromEnv('BUILD_DIR', 'build');
  },

  get APP_DIR() {
    return getDirFromEnv('APP_DIR', 'src');
  },

  get PUBLIC_DIR() {
    return getDirFromEnv('PUBLIC_DIR', 'public');
  },

  get bundleMaxAssetSize() {
    return env('WEBPACK_MAX_ASSET_SIZE', 250_000); // 250KB
  },
};
