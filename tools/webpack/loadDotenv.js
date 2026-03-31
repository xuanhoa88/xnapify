/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { logInfo, logWarn } = require('../utils/logger');

/**
 * Load XNAPIFY_ environment variables for client-side bundles.
 *
 * SECURITY: Default-deny. Only variables with the `XNAPIFY_PUBLIC_` prefix
 * are included in the client bundle. Everything else stays server-only.
 *
 * Naming convention:
 *   XNAPIFY_PUBLIC_APP_NAME  → ✅ included in client bundle
 *   XNAPIFY_KEY              → ❌ server-only (no _PUBLIC_)
 *   XNAPIFY_SMTP_KEY         → ❌ server-only
 *
 * @param {Object} options - Plugin options
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @returns {Object} Webpack DefinePlugin definitions
 */
function loadDotenv(options = {}) {
  const { verbose = false } = options;

  const envVars = Object.keys(process.env)
    .filter(key => key.startsWith('XNAPIFY_PUBLIC_'))
    .reduce((acc, key) => {
      acc[`process.env.${key}`] = JSON.stringify(process.env[key]);
      return acc;
    }, {});

  if (verbose && Object.keys(envVars).length > 0) {
    logInfo('🔧 Dotenv Plugin: Public environment variables:');
    Object.keys(envVars).forEach(key => {
      const value = envVars[key];
      const maskedValue =
        value.length > 10
          ? `${value.substring(0, 6)}...${value.substring(value.length - 2)}`
          : value;
      logInfo(`   ${key} = ${maskedValue}`);
    });
  } else if (verbose) {
    logWarn(
      `⚠️ Dotenv Plugin: No public environment variables found (need _PUBLIC_ in key name)`,
    );
  }

  return envVars;
}

module.exports = loadDotenv;
