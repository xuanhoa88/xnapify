/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Strategy } from 'passport-strategy';

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
      const token = auth.getTokenFromCookie(req);

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

    // Find user to get ID
    const { User } = container.resolve('models');
    const user = await User.findOne({
      where: { email: username },
      attributes: ['id', 'email'],
    });

    if (!user) return null;

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
