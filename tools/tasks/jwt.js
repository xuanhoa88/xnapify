/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { logInfo } from '../lib/logger';

/**
 * Checks if a value is invalid (empty, whitespace only, or missing)
 */
function isInvalidValue(value) {
  return !value || value.trim() === '';
}

/**
 * Generates a new JWT secret and updates the .env file
 */
async function main(nodeEnv = process.env.NODE_ENV) {
  const envPath = path.resolve(
    process.cwd(),
    `.env.${nodeEnv || 'development'}`,
  );
  const envDefaultsPath = path.resolve(process.cwd(), '.env.defaults');

  // Check if .env exists, if not copy from .env.defaults
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envDefaultsPath)) {
      logInfo('🔄 Creating .env file from .env.defaults...');
      fs.copyFileSync(envDefaultsPath, envPath);
    } else {
      throw new Error('.env file not found and .env.defaults is missing');
    }
  }

  // Read .env file
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Handle RSK_JWT_SECRET
  const secretKey = 'RSK_JWT_SECRET';
  const secretRegex = new RegExp(`^${secretKey}=(.*)`, 'm');
  const secretMatch = envContent.match(secretRegex);
  const secret = crypto.randomBytes(32).toString('hex');

  if (!secretMatch || isInvalidValue(secretMatch[1])) {
    if (secretMatch) {
      // Exists but invalid - replace it
      envContent = envContent.replace(secretRegex, `${secretKey}=${secret}`);
      logInfo('✅ Updated invalid RSK_JWT_SECRET in .env');
    } else {
      // Doesn't exist - append it
      if (envContent.length > 0 && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `${secretKey}=${secret}\n`;
      logInfo('✅ Appended RSK_JWT_SECRET to .env');
    }
  }

  // Handle RSK_JWT_EXPIRES_IN
  const expiresKey = 'RSK_JWT_EXPIRES_IN';
  const expiresRegex = new RegExp(`^${expiresKey}=(.*)`, 'm');
  const expiresMatch = envContent.match(expiresRegex);
  const defaultExpires = '7d';

  if (!expiresMatch || isInvalidValue(expiresMatch[1])) {
    if (expiresMatch) {
      // Exists but invalid - replace it
      envContent = envContent.replace(
        expiresRegex,
        `${expiresKey}=${defaultExpires}`,
      );
      logInfo('✅ Updated invalid RSK_JWT_EXPIRES_IN to 7d in .env');
    } else {
      // Doesn't exist - append it
      if (envContent.length > 0 && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `${expiresKey}=${defaultExpires}\n`;
      logInfo('✅ Appended RSK_JWT_EXPIRES_IN to .env');
    }
  }

  // Write back to .env
  fs.writeFileSync(envPath, envContent, 'utf8');
}

export default main;

// Execute if called directly (as child process)
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
