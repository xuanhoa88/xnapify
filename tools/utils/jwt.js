/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const crypto = require('crypto');
const path = require('path');

const { pathExists, readFile, writeFile } = require('./fs');
const { logInfo, logWarn, logDebug } = require('./logger');

/**
 * Generate a secure random JWT secret
 * @returns {string} Base64URL encoded secret (256 bits)
 */
function generateSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Parse .env file content into a Map of key-value pairs
 * Preserves comments and empty lines
 * @param {string} content - .env file content
 * @returns {Object} Parsed data with lines array and keys map
 */
function parseEnvFile(content) {
  const lines = content.split('\n');
  const keys = new Map();

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    // Parse key=value pairs
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();
      keys.set(key, { value, lineIndex: index });
    }
  });

  return { lines, keys };
}

/**
 * Update or add JWT configuration to .env file content
 * @param {Array<string>} lines - Original file lines
 * @param {Map} existingKeys - Map of existing keys with their line indices
 * @param {Object} jwtConfig - JWT configuration to add/update
 * @returns {Array<string>} Updated lines
 */
function updateEnvContent(lines, existingKeys, jwtConfig) {
  const updatedLines = [...lines];
  const processedKeys = new Set();

  // Update existing keys
  Object.entries(jwtConfig).forEach(([key, value]) => {
    if (existingKeys.has(key)) {
      const { lineIndex } = existingKeys.get(key);
      updatedLines[lineIndex] = `${key}=${value}`;
      processedKeys.add(key);
      logDebug(`Updated existing key: ${key}`);
    }
  });

  // Add new keys that didn't exist
  const newKeys = Object.entries(jwtConfig).filter(
    ([key]) => !processedKeys.has(key),
  );

  if (newKeys.length > 0) {
    // Add a blank line before new keys if file doesn't end with one
    const lastLine = updatedLines[updatedLines.length - 1];
    if (lastLine && lastLine.trim() !== '') {
      updatedLines.push('');
    }

    // Add new keys
    newKeys.forEach(([key, value]) => {
      updatedLines.push(`${key}=${value}`);
      logDebug(`Added new key: ${key}`);
    });
  }

  return updatedLines;
}

/**
 * Generate JWT configuration and update .env file
 *
 * This function:
 * 1. Checks if .env file already exists
 * 2. If .env exists:
 *    - Preserves existing XNAPIFY_JWT_SECRET (even if empty)
 *    - Only generates new secret if missing or empty
 * 3. If .env doesn't exist (first-time setup):
 *    - Creates .env from .env.xnapify template (or minimal config)
 *    - Generates a new secure random JWT secret automatically
 * 4. Updates XNAPIFY_JWT_SECRET and XNAPIFY_JWT_EXPIRY
 * 5. Writes back to .env file
 * 6. For production builds (when buildDir is provided):
 *    - Copies the .env file to the build directory
 *
 * @param {string} cwd - Current working directory
 * @param {Object} options - Optional configuration
 * @param {string} options.buildDir - Build directory path (for production builds)
 * @returns {Promise<void>}
 */
async function generateJWT(cwd, buildDir) {
  try {
    logInfo(
      `🔐 Checking JWT configuration for ${process.env.NODE_ENV || 'development'}...`,
    );

    // Determine source and target paths
    const envPath = path.resolve(buildDir || cwd, '.env');
    const envDefaultsPath = path.resolve(cwd, '.env.xnapify');

    let envContent = '';
    let shouldGenerateSecret = false;

    // Try to read existing .env file first
    if (await pathExists(envPath)) {
      envContent = await readFile(envPath, { encoding: 'utf8' });
      logDebug(`Reading existing .env file`);

      // Parse to check if secret exists
      const { keys } = parseEnvFile(envContent);
      const existingSecret = keys.has('XNAPIFY_JWT_SECRET')
        ? keys.get('XNAPIFY_JWT_SECRET').value
        : null;

      // Only generate if secret is missing or empty in existing .env
      shouldGenerateSecret = !existingSecret || existingSecret.trim() === '';
    }
    // Fall back to .env.xnapify if .env doesn't exist
    else if (await pathExists(envDefaultsPath)) {
      envContent = await readFile(envDefaultsPath, { encoding: 'utf8' });
      logWarn(`.env file not found, creating from .env.xnapify`);

      // First-time creation: generate secret for out-of-the-box functionality
      shouldGenerateSecret = true;
    }
    // Create minimal .env if neither exists
    else {
      logWarn(`Neither .env nor .env.xnapify found, creating minimal .env`);
      envContent = '# xnapify - Environment Configuration\n\n';

      // Generate secret for brand new minimal .env
      shouldGenerateSecret = true;
    }

    // Parse existing content
    const { lines, keys } = parseEnvFile(envContent);

    // Determine JWT secret value
    let jwtSecret;
    const existingSecret = keys.has('XNAPIFY_JWT_SECRET')
      ? keys.get('XNAPIFY_JWT_SECRET').value
      : null;

    if (shouldGenerateSecret) {
      jwtSecret = generateSecret();
      logInfo(`🔑 Generating new JWT secret...`);
    } else if (existingSecret) {
      jwtSecret = existingSecret;
      logInfo(`✅ Using existing JWT secret`);
    } else {
      // Preserve empty value from template
      jwtSecret = '';
      logInfo(`ℹ️  XNAPIFY_JWT_SECRET is empty (manual configuration required)`);
    }

    // JWT configuration to add/update (using XNAPIFY_ prefix)
    const jwtConfig = {
      XNAPIFY_JWT_SECRET: jwtSecret,
      XNAPIFY_JWT_EXPIRY: keys.has('XNAPIFY_JWT_EXPIRY')
        ? keys.get('XNAPIFY_JWT_EXPIRY').value
        : '7d',
    };

    // Update content with JWT config
    const updatedLines = updateEnvContent(lines, keys, jwtConfig);

    // Write updated content back to .env
    await writeFile(envPath, updatedLines.join('\n'));

    // Log success
    if (!(await pathExists(envPath))) {
      logInfo(`✅ Created ${path.basename(envPath)}`);
    } else if (shouldGenerateSecret) {
      logInfo(`✅ Generated new JWT secret in ${path.basename(envPath)}`);
      logInfo(`   🔑 Secret: ${jwtSecret.substring(0, 10)}...`);
    } else {
      logInfo(`✅ JWT configuration verified in ${path.basename(envPath)}`);
    }

    if (jwtSecret) {
      logInfo(`   ⏰ Token expires: ${jwtConfig.XNAPIFY_JWT_EXPIRY}`);
    }

    // Update process.env directly since we know the values
    // This allows the current process to use the new secret immediately
    // without relying on dotenv-flow to reload (which doesn't overwrite existing vars)
    process.env.XNAPIFY_JWT_SECRET = jwtConfig.XNAPIFY_JWT_SECRET;
    process.env.XNAPIFY_JWT_EXPIRY = jwtConfig.XNAPIFY_JWT_EXPIRY;
  } catch (error) {
    throw new Error(`Failed to generate JWT configuration: ${error.message}`);
  }
}

module.exports = { generateJWT };
