/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Cookie and Session utilities
export {
  // Core cookie operations
  setSecureCookie,
  clearSecureCookie,
  getCookieValue,
  hasCookie,
  DEFAULT_COOKIE_CONFIG,

  // JWT token operations
  setTokenCookie,
  clearTokenCookie,
  getTokenFromCookie,
  hasTokenCookie,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  clearAllAuthCookies,
  getCookieConfig,
  validateCookieOptions,

  // Session operations
  generateSessionId,
  createSession,
  destroySession,
  getSessionId,
} from './cookies';

// OAuth utilities
export * as oauth from './oauth';

// JWT utilities
export * as jwt from './jwt';

// Authentication middleware
export * as middlewares from './middleware';
