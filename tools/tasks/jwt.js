#!/usr/bin/env node

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const crypto = require('crypto');
const path = require('path');
const { readFile, writeFile } = require('../utils/fs');
const { logInfo } = require('../utils/logger');

/**
 * Generate JWT config options and update .env file
 * @param {string} nodeEnv - Environment to generate for ('development', 'production', etc.)
 * @returns {Promise<void>}
 */
async function main(nodeEnv = process.env.NODE_ENV) {
  // Determine which .env file to update
  const envFile = nodeEnv ? `.env.${nodeEnv}` : '.env';
  const envPath = path.resolve(process.cwd(), envFile);

  logInfo(`🔐 Generating JWT configuration for ${nodeEnv || 'default'}...`);

  // Generate secure random secret (256 bits = 32 bytes)
  const jwtSecret = crypto.randomBytes(32).toString('base64url');

  // Default expiration times
  const jwtExpiresIn = '7d';
  const jwtRefreshExpiresIn = '30d';

  // JWT configuration to add/update
  const jwtConfig = {
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    JWT_REFRESH_EXPIRES_IN: jwtRefreshExpiresIn,
  };

  // Read existing .env file or create empty
  let envContent = '';
  try {
    envContent = await readFile(envPath, { encoding: 'utf8' });
  } catch {
    // File doesn't exist, will be created
  }

  // Parse existing content
  const lines = envContent.split('\n');
  const existingKeys = new Set();

  // Update existing keys or add new ones
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }

    const [key] = trimmed.split('=');
    if (key && jwtConfig[key] !== undefined) {
      existingKeys.add(key);
      return `${key}=${jwtConfig[key]}`;
    }

    return line;
  });

  // Add new keys that didn't exist
  Object.entries(jwtConfig).forEach(([key, value]) => {
    if (!existingKeys.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  });

  // Write updated content
  await writeFile(envPath, updatedLines.join('\n'));

  logInfo(`✅ JWT configuration updated in ${envFile}`);
  logInfo(`   🔑 Secret: ${jwtSecret.substring(0, 8)}...`);
  logInfo(`   ⏰ Token expires: ${jwtExpiresIn}`);
  logInfo(`   🔄 Refresh expires: ${jwtRefreshExpiresIn}`);
}

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = main;
