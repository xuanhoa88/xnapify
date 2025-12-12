/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure OAuth state parameter
 *
 * @param {number} [length=32] - Length of the state parameter in bytes
 * @returns {string} Secure state parameter
 */
export function generateOAuthState(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate PKCE code verifier and challenge
 *
 * @returns {Object} Object containing code verifier and challenge
 * @returns {string} returns.codeVerifier - Code verifier for PKCE
 * @returns {string} returns.codeChallenge - Code challenge for PKCE
 */
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * Build OAuth authorization URL
 *
 * @param {Object} config - OAuth configuration
 * @param {string} config.authUrl - Authorization server URL
 * @param {string} config.clientId - OAuth client ID
 * @param {string} config.redirectUri - Redirect URI
 * @param {string[]} [config.scopes] - Requested scopes
 * @param {string} [config.state] - State parameter
 * @param {string} [config.codeChallenge] - PKCE code challenge
 * @param {Object} [config.additionalParams] - Additional parameters
 * @returns {string} Authorization URL
 */
export function buildAuthUrl(config) {
  const {
    authUrl,
    clientId,
    redirectUri,
    scopes = [],
    state,
    codeChallenge,
    additionalParams = {},
  } = config;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    ...additionalParams,
  });

  if (scopes.length > 0) {
    params.set('scope', scopes.join(' '));
  }

  if (state) {
    params.set('state', state);
  }

  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  return `${authUrl}?${params.toString()}`;
}

/**
 * Validate OAuth callback parameters
 *
 * @param {Object} params - Callback parameters
 * @param {string} params.code - Authorization code
 * @param {string} params.state - State parameter
 * @param {string} expectedState - Expected state value
 * @returns {Object} Validation result
 */
export function validateOAuthCallback(params, expectedState) {
  const errors = [];

  if (!params.code) {
    errors.push('OAUTH_CODE_REQUIRED');
  }

  if (!params.state) {
    errors.push('OAUTH_STATE_REQUIRED');
  } else if (params.state !== expectedState) {
    errors.push('OAUTH_STATE_MISMATCH');
  }

  if (params.error) {
    errors.push(
      `OAUTH_ERROR: ${params.error} - ${params.error_description || 'OAUTH_ERROR_UNKNOWN'}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Common OAuth provider configurations
 */
export const OAUTH_PROVIDERS = Object.freeze({
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email'],
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'profile', 'email'],
  },
});
