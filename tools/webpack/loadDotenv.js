/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { logInfo, logWarn } = require('../utils/logger');

/**
 * Webpack plugin to load environment variables with XNAPIFY_ prefix
 * and inject them into the bundle using DefinePlugin.
 *
 * This plugin:
 * 1. Scans process.env for variables with XNAPIFY_ prefix
 * 2. Creates DefinePlugin definitions for each variable
 * 3. Makes them available as process.env.XNAPIFY_* in the bundle
 *
 * @param {Object} options - Plugin options
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @returns {Object} Webpack DefinePlugin definitions
 */
function loadDotenv(options = {}) {
  const { verbose = false } = options;

  // Load environment variables using dotenv-flow
  // This supports .env, .env.local, .env.[node_env], etc.
  // Note: dotenv-flow is initialized in tools/run.js, so process.env is already populated

  // Find all environment variables with the specified prefix
  const envVars = Object.keys(process.env)
    .filter(key => key.startsWith('XNAPIFY_'))
    .reduce((acc, key) => {
      // Create DefinePlugin definition: process.env.XNAPIFY_* = 'value'
      acc[`process.env.${key}`] = JSON.stringify(process.env[key]);
      return acc;
    }, {});

  // Log found variables in verbose mode
  if (verbose && Object.keys(envVars).length > 0) {
    logInfo('🔧 Dotenv Plugin: Found environment variables:');
    Object.keys(envVars).forEach(key => {
      const value = envVars[key];
      // Mask sensitive values (show only first 4 chars)
      const maskedValue =
        value.length > 10
          ? `${value.substring(0, 6)}...${value.substring(value.length - 2)}`
          : value;
      logInfo(`   ${key} = ${maskedValue}`);
    });
  } else if (verbose) {
    logWarn(
      `⚠️ Dotenv Plugin: No environment variables found with prefix "XNAPIFY_"`,
    );
  }

  return envVars;
}

module.exports = loadDotenv;
