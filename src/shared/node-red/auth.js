/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Node-RED Authentication Integration
 *
 * Integrates the application's JWT-based authentication and RBAC system
 * with Node-RED's adminAuth configuration for seamless single sign-on.
 */

/**
 * Create Node-RED authentication configuration
 *
 * This implements a session-based authentication strategy that:
 * - Verifies JWT tokens from cookies using the existing auth system
 * - Checks user permissions via the RBAC service
 * - Grants access to users with 'nodered:admin' permission or '*:*' wildcard
 *
 * @param {Object} app - Express app instance with auth services
 * @returns {Object} Node-RED adminAuth configuration
 */
import { Strategy } from 'passport-strategy';

/**
 * Custom Passport Strategy for RSK Authentication
 *
 * Adapts the application's JWT/RBAC system to a Passport strategy
 * compatible with Node-RED's adminAuth.
 */
class RskAuthStrategy extends Strategy {
  constructor(options, verify) {
    super();
    this.name = 'rsk-auth';
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
      const jwt = app.get('jwt');
      const auth = app.get('auth');

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

      // Verify token
      let decoded;
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

      if (!decoded || !decoded.id) {
        console.warn('⚠️  [Node-RED Auth] Token decoded but missing ID');
        return this.redirect('/admin');
      }

      // Resolve permissions via hook system
      const {
        middlewares: { hasPermission },
      } = app.get('auth');

      if (!hasPermission) {
        console.error('❌ [Node-RED Auth] Auth middlewares not available');
        return this.fail(500);
      }

      // Attach user to request for hook resolution
      req.user = { id: decoded.id };
      req.app = app; // Ensure app is available on request

      // Get user's permissions using hook system
      let permissions;
      try {
        const hook = app.get('hook');
        if (hook && hook.has('auth.permissions')) {
          await hook('auth.permissions').emit('resolve', req);
        }
        permissions = req.user.permissions || [];
      } catch (permError) {
        console.error(
          '❌ [Node-RED Auth] Failed to get user permissions:',
          permError.message,
        );
        return this.fail(500);
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
    const {
      middlewares: { hasPermission },
    } = app.get('auth');

    if (!hasPermission) {
      console.error('❌ [Node-RED Auth] Auth middlewares not available');
      return null;
    }

    // Find user to get ID
    const { User } = app.get('models');
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
    const hook = app.get('hook');
    if (hook && hook.has('auth.permissions')) {
      await hook('auth.permissions').emit('resolve', req);
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
      name: 'rsk-auth',
      label: 'Authentication',
      icon: 'icons/node-red.svg',
      autoLogin: true,
      strategy: RskAuthStrategy,
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
      redirect: `${protocol}://${host}:${port}/api/logout`,
    },
  };
}
