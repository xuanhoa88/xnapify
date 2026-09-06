/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Strategy } from 'passport-strategy';

import { verifyActiveSession } from '@shared/api/engines/auth/revocation.js';
import {
  getTokenFromCookie,
  getRefreshTokenFromCookie,
} from '@shared/cookies/index.js';

/**
 * Custom Passport Strategy for xnapify Authentication
 *
 * Adapts the application's JWT/RBAC system to a Passport strategy
 * compatible with Node-RED's adminAuth.
 */
class XnapifyAuthStrategy extends Strategy {
  constructor(options, verify) {
    super();
    this.name = 'xnapify-auth';
    this.app = options.app;
    this.verify = verify; // Node-RED's verify callback
  }

  /**
   * Authenticate request
   *
   * @param {Object} req - Express request
   */
  async authenticate(req) {
    const { app } = this;

    try {
      // Get auth services from app
      const container = app.get('container');
      const jwt = container.resolve('jwt');
      const auth = container.resolve('auth');

      if (!jwt || !auth) {
        console.error('❌ [Node-RED Auth] JWT or auth service not available');
        return this.fail(500);
      }

      // Extract JWT token from cookie
      const token = getTokenFromCookie(req);

      if (!token) {
        console.warn('⚠️  [Node-RED Auth] No token found in request cookies');
        console.warn('   Cookies present:', Object.keys(req.cookies || {}));
        // No token — redirect to main app login
        return this.redirect('/admin');
      }

      // Verify token - check cache first
      let decoded;
      const cachedUser = jwt.cache.get(token);

      if (cachedUser) {
        decoded = cachedUser;
      } else {
        try {
          decoded = jwt.verifyTypedToken(token, 'access');
        } catch (tokenError) {
          console.warn(
            '⚠️  [Node-RED Auth] Token verification failed:',
            tokenError.message,
          );
          // Token invalid or expired — redirect to main app login
          return this.redirect('/admin');
        }
      }

      if (!decoded || !decoded.id) {
        console.warn('⚠️  [Node-RED Auth] Token decoded but missing ID');
        return this.redirect('/admin');
      }

      // A valid signature is not a live session. Without this check a user
      // who logged out, was deactivated, or had their password reset keeps
      // the flow editor — and Node-RED then mints its own ~7 day bearer
      // token, so the revocation would never reach them at all.
      try {
        await verifyActiveSession(container, decoded);
      } catch (revocationError) {
        if (revocationError.name === 'SessionStoreUnavailableError') {
          console.error(
            '❌ [Node-RED Auth] Cannot verify session state:',
            revocationError.message,
          );
          return this.fail(503);
        }
        console.warn(
          '⚠️  [Node-RED Auth] Session is no longer valid:',
          revocationError.code || revocationError.message,
        );
        return this.redirect('/admin');
      }

      // Resolve permissions via hook system
      const {
        middlewares: { hasPermission },
      } = container.resolve('auth');

      if (!hasPermission) {
        console.error('❌ [Node-RED Auth] Auth middlewares not available');
        return this.fail(500);
      }

      // If permissions are already in the decoded token (from cache or payload), use them
      // Otherwise hit the DB via the hook system
      let { permissions } = decoded;

      if (!permissions) {
        // Attach user to request for hook resolution
        req.user = { id: decoded.id };
        req.app = app; // Ensure app is available on request

        try {
          const hook = container.resolve('hook');
          if (hook && hook.has('auth.permissions')) {
            await hook('auth.permissions').invoke('resolve', req);
          }
          permissions = req.user.permissions || [];

          // Cache the resolved permissions back into the token payload
          // so subequent Node-RED requests don't hit the DB again
          decoded.permissions = permissions;
          if (!cachedUser) {
            jwt.cacheToken(token, decoded);
          }
        } catch (permError) {
          console.error(
            '❌ [Node-RED Auth] Failed to get user permissions:',
            permError.message,
          );
          return this.fail(500);
        }
      }

      // Check if user has Node-RED permissions
      const hasFullAccess = hasPermission(permissions, 'nodered:admin');
      const hasReadAccess = hasPermission(permissions, 'nodered:read');

      let scope;
      if (hasFullAccess) {
        scope = '*';
      } else if (hasReadAccess) {
        scope = 'read';
      } else {
        console.warn(
          `⚠️  [Node-RED Auth] User ${decoded.email} lacks valid Node-RED permissions`,
        );
        return this.fail(403);
      }

      // User authenticated and authorized
      const userProfile = {
        username: decoded.email,
        image: decoded.picture || '',
        permissions: scope,
      };

      this.verify(userProfile, (err, user) => {
        if (err) {
          this.error(err);
        } else if (!user) {
          this.fail(401);
        } else {
          this.success(user);
        }
      });
    } catch (error) {
      console.error('❌ [Node-RED Auth] Authentication error:', error);
      this.error(error);
    }
  }
}

/**
 * Fetch user with permissions from database
 * @param {Object} app - Express app instance
 * @param {string} username - Email/username to look up
 */
async function getUserWithPermissions(app, username) {
  try {
    const container = app.get('container');
    const {
      middlewares: { hasPermission },
    } = container.resolve('auth');

    if (!hasPermission) {
      console.error('❌ [Node-RED Auth] Auth middlewares not available');
      return null;
    }

    // Find user to get ID.
    //
    // Node-RED issues its own bearer token once it has accepted the JWT, and
    // its BearerStrategy calls this on every admin request — so this is the
    // one place where a revoked account can be caught on that token. Load
    // the account state, not just the id.
    const { User } = container.resolve('models');
    const user = await User.findOne({
      where: { email: username },
      attributes: ['id', 'email', 'is_active', 'is_locked', 'locked_until'],
    });

    if (!user) return null;

    const lockedByTime =
      user.locked_until && user.locked_until.getTime() > Date.now();

    if (!user.is_active || user.is_locked || lockedByTime) {
      console.warn(
        `⚠️  [Node-RED Auth] Account ${username} is no longer eligible`,
      );
      return null;
    }

    // Create mock request for hook resolution
    const req = {
      app,
      user: { id: user.id },
    };

    // Get permissions using hook system
    const hook = container.resolve('hook');
    if (hook && hook.has('auth.permissions')) {
      await hook('auth.permissions').invoke('resolve', req);
    }
    const permissions = req.user.permissions || [];

    // Determine Node-RED scope
    const hasFullAccess = hasPermission(permissions, 'nodered:admin');
    const hasReadAccess = hasPermission(permissions, 'nodered:read');

    let scope = '';
    if (hasFullAccess) {
      scope = '*';
    } else if (hasReadAccess) {
      scope = 'read';
    }

    // Permissions revoked since the token was issued: refuse the lookup
    // rather than handing Node-RED an authenticated user with no scope.
    if (!scope) return null;

    // Return user profile with permissions
    return {
      username: user.email,
      permissions: scope,
    };
  } catch (error) {
    console.error('❌ [Node-RED Auth] User lookup failed:', error);
    return null;
  }
}

/**
 * Is the refresh cookie still backed by a live session?
 *
 * The presence of the cookie proves nothing — the browser keeps it until
 * something clears it — so the family row is what decides.
 *
 * @param {Object} container - DI container
 * @param {Object} req - Express request
 * @returns {Promise<boolean>}
 */
async function isRefreshSessionLive(container, req) {
  const refreshToken = getRefreshTokenFromCookie(req);
  if (!refreshToken) return false;

  let jti;
  try {
    ({ jti } = container.resolve('jwt').verifyTypedToken(
      refreshToken,
      'refresh',
    ));
  } catch {
    return false;
  }
  if (!jti || !container.has('models')) return false;

  const { RefreshToken } = container.resolve('models');
  if (!RefreshToken) return false;

  const record = await RefreshToken.findByPk(jti, {
    attributes: ['id', 'revoked_at'],
  });
  return !!record && !record.revoked_at;
}

/**
 * Guard the Node-RED admin surface with the main application's session.
 *
 * Node-RED hands out its own bearer token with a ~7 day lifetime once it has
 * accepted the JWT once, so nothing else would ever re-check the session
 * behind an open editor. This runs on every admin request: when the main
 * session is gone or revoked it strips the bearer token, Node-RED's own auth
 * fails, and the login dialog sends the user back to /admin.
 *
 * @param {Object} app - Express app instance
 * @returns {Function} Express middleware
 */
export function createNodeRedSessionGuard(app) {
  return async function nodeRedSessionGuard(req, _res, next) {
    try {
      const container = app.get('container');
      const auth = container && container.resolve('auth');
      const jwt = container && container.resolve('jwt');

      // Skip guard if auth services aren't available yet
      if (!auth || !jwt) return next();

      const token = getTokenFromCookie(req);
      if (token) {
        let decoded = null;
        try {
          decoded = jwt.verifyTypedToken(token, 'access');
        } catch {
          decoded = null;
        }

        if (decoded) {
          try {
            await verifyActiveSession(container, decoded);
            // Cookie is valid and the session is live — proceed normally
            return next();
          } catch (error) {
            if (error.name === 'SessionStoreUnavailableError') {
              // Cannot tell. An outage must not evict everyone from the
              // editor mid-deploy.
              console.error(
                '❌ [Node-RED Auth] Session state unavailable:',
                error.message,
              );
              return next();
            }
            // Revoked — fall through and strip the bearer token
          }
        } else if (await isRefreshSessionLive(container, req)) {
          // Access token expired but the session behind it is still live:
          // keep Node-RED's bearer token alive so deploys don't fail
          // mid-session.
          return next();
        }
      }

      // Main app session gone or revoked: strip Node-RED's bearer token so
      // its BearerStrategy fails, triggering the login dialog which
      // redirects to /admin via XnapifyAuthStrategy
      delete req.headers.authorization;
      return next();
    } catch (error) {
      // Fail closed: the worst case is the editor asking the user to log in
      console.warn('⚠️  [Node-RED Auth] Session guard error:', error.message);
      delete req.headers.authorization;
      return next();
    }
  };
}

export function createNodeRedAuth(options = {}) {
  const { app } = options;
  return {
    type: 'strategy',
    strategy: {
      name: 'xnapify-auth',
      label: 'Authentication',
      icon: 'icons/node-red.svg',
      autoLogin: true,
      strategy: XnapifyAuthStrategy,
      options,
    },
    // Define users function to support user lookup by BearerStrategy
    // This is required because BearerStrategy verifies the user exists after validating the token
    users(username) {
      return getUserWithPermissions(app, username);
    },
    // Define authenticate function to pass-through user profile
    // This allows the strategy to determine permissions and pass them to Node-RED
    authenticate(userProfile) {
      return Promise.resolve(userProfile);
    },
  };
}

/**
 * Create logout configuration for Node-RED editor
 *
 * @param {Object} options - Logout configuration options
 * @param {string} [options.protocol='http'] - Server protocol
 * @param {string} [options.host='127.0.0.1'] - Server host
 * @param {number} [options.port=1337] - Server port
 * @returns {Object} Logout configuration for editorTheme
 */
export function createNodeRedLogoutConfig(options = {}) {
  const { protocol = 'http', host = '127.0.0.1', port = 1337 } = options;

  return {
    logout: {
      redirect: `${protocol}://${host}:${port}/api/auth/logout`,
    },
  };
}
