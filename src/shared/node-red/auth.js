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
        // No token - user not authenticated
        return this.fail(401);
      }

      // Verify token
      let decoded;
      try {
        decoded = jwt.verifyTypedToken(token, 'access');
      } catch (tokenError) {
        // Token invalid or expired
        return this.fail(401);
      }

      if (!decoded || !decoded.id) {
        return this.fail(401);
      }

      // Import RBAC helpers from registered middlewares
      const { getUserPermissions, hasPermission } = app.get('user.middlewares');

      if (!getUserPermissions || !hasPermission) {
        console.error('❌ [Node-RED Auth] User middlewares not available');
        return this.fail(500);
      }

      // Attach user to request for getUserPermissions
      req.user = { id: decoded.id };
      req.app = app; // Ensure app is available on request

      // Get user's permissions using shared middleware logic
      let permissions;
      try {
        permissions = await getUserPermissions(req);
      } catch (permError) {
        console.error(
          '❌ [Node-RED Auth] Failed to get user permissions:',
          permError.message,
        );
        return this.fail(500);
      }

      // Check if user has Node-RED admin permission
      const hasNodeRedAccess = hasPermission(permissions, 'nodered:admin');

      if (!hasNodeRedAccess) {
        console.warn(
          `⚠️  [Node-RED Auth] User ${decoded.email} lacks nodered:admin permission`,
        );
        return this.fail(403);
      }

      // User authenticated and authorized
      const userProfile = {
        username: decoded.email,
        image: decoded.picture || '',
        permissions: '*', // Grant full admin access
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

export function createNodeRedAuth(app) {
  return {
    type: 'strategy',
    strategy: {
      name: 'rsk-auth',
      label: 'Authentication',
      icon: 'icons/node-red.svg',
      strategy: RskAuthStrategy,
      options: {
        app, // Pass app instance to strategy
      },
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
