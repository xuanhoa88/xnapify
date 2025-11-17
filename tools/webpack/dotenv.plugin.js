/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { logInfo, logWarn } from '../lib/logger';

/**
 * Webpack plugin to load environment variables with RSK_ prefix
 * and inject them into the bundle using DefinePlugin.
 *
 * This plugin:
 * 1. Scans process.env for variables with RSK_ prefix
 * 2. Creates DefinePlugin definitions for each variable
 * 3. Makes them available as process.env.RSK_* in the bundle
 *
 * Example:
 *   RSK_API_URL=https://api.example.com
 *   RSK_FEATURE_FLAG=true
 *
 * Usage in code:
 *   const apiUrl = process.env.RSK_API_URL;
 *   const featureFlag = process.env.RSK_FEATURE_FLAG === 'true';
 *
 * @param {Object} options - Plugin options
 * @param {string} options.prefix - Environment variable prefix (default: 'RSK_')
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @returns {Object} Webpack DefinePlugin definitions
 */
export function createDotenvDefinitions(options = {}) {
  const { prefix = 'RSK_', verbose = false } = options;

  // Find all environment variables with the specified prefix
  const envVars = Object.keys(process.env)
    .filter(key => key.startsWith(prefix))
    .reduce((acc, key) => {
      // Create DefinePlugin definition: process.env.RSK_* = 'value'
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
      `⚠️  Dotenv Plugin: No environment variables found with prefix "${prefix}"`,
    );
  }

  return envVars;
}
