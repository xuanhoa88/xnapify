/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_JWT_CONFIG, JWT_TOKEN_TYPES } from './constants';

/**
 * Validate JWT configuration
 *
 * @param {Object} config - JWT configuration to validate
 * @returns {Object} Validation result
 */
export function validateJwtConfig(config = {}) {
  const errors = [];

  if (
    config.algorithm &&
    !['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'].includes(
      config.algorithm,
    )
  ) {
    errors.push('JWT_INVALID_ALGORITHM');
  }

  if (
    config.expiresIn &&
    typeof config.expiresIn !== 'string' &&
    typeof config.expiresIn !== 'number'
  ) {
    errors.push('JWT_INVALID_EXPIRES_IN');
  }

  if (
    config.issuer &&
    (typeof config.issuer !== 'string' || config.issuer.trim().length === 0)
  ) {
    errors.push('JWT_INVALID_ISSUER');
  }

  if (
    config.audience &&
    (typeof config.audience !== 'string' || config.audience.trim().length === 0)
  ) {
    errors.push('JWT_INVALID_AUDIENCE');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get JWT configuration for token type
 *
 * @param {string} type - Token type
 * @param {Object} [overrides] - Configuration overrides
 * @returns {Object} JWT configuration
 */
export function getJwtConfig(type = 'access', overrides = {}) {
  const tokenConfig = JWT_TOKEN_TYPES[type] || JWT_TOKEN_TYPES.access;

  return Object.freeze({
    ...DEFAULT_JWT_CONFIG,
    ...tokenConfig,
    ...overrides,
  });
}
