/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Hook channel name for ownership resolution.
 * Modules can register a listener on this channel to resolve the resource owner.
 */
const HOOK_CHANNEL = 'auth.ownership';

/**
 * Hook channel name for shared ownership resolution.
 * Modules can register a listener on this channel to populate `req.sharedOwners`.
 */
const SHARED_HOOK_CHANNEL = 'auth.shared_ownership';

/**
 * Hook channel name for hierarchical ownership resolution.
 * Modules can register a listener on this channel to populate `req.ownerChain`.
 */
const HIERARCHICAL_HOOK_CHANNEL = 'auth.hierarchical_ownership';

/**
 * Hook channel name for time-based ownership resolution.
 * Modules can register a listener on this channel to populate
 * `req.isOwner` and `req.ownershipExpiresAt`.
 */
const TIME_BASED_HOOK_CHANNEL = 'auth.time_based_ownership';

/**
 * Middleware to check if the authenticated user owns the requested resource.
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Admin role bypasses ownership checks by default.
 *
 * Ownership can be resolved in two ways:
 * 1. **Param-based** (default): compares `req.user.id` against a route param (e.g. `:userId`).
 * 2. **Hook-based**: emits `auth.ownership` hook to let modules resolve ownership
 *    from the database (e.g. checking if a post belongs to the user).
 *
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.param='userId'] - Route param name containing the resource owner ID
 * @param {string} [options.userIdField='id'] - Field on `req.user` to compare against
 * @param {boolean} [options.adminBypass=true] - Whether admin role bypasses the check
 * @param {string} [options.resourceType] - Optional resource type for hook-based resolution
 *   When set, emits `auth.ownership` hook with `{ resourceType, req }` to let modules
 *   set `req.isOwner = true/false` on the request.
 * @returns {Function} Express middleware
 *
 * @example
 * // Param-based: /users/:userId/profile — checks req.params.userId === req.user.id
 * router.put('/users/:userId/profile', requireOwnership(), controller.update);
 *
 * // Custom param name: /posts/:authorId
 * router.put('/posts/:authorId', requireOwnership({ param: 'authorId' }), controller.update);
 *
 * // Hook-based: let the posts module resolve ownership from DB
 * router.put('/posts/:id', requireOwnership({ resourceType: 'post' }), controller.update);
 */
export function requireOwnership(options = {}) {
  const {
    param = 'userId',
    userIdField = 'id',
    adminBypass = true,
    resourceType,
  } = options;

  return async (req, res, next) => {
    // 1. Check if user is authenticated
    if (!req.user) {
      const error = new Error('User not authenticated');
      error.name = 'AuthenticationRequiredError';
      error.status = 401;
      error.code = 'AUTH_REQUIRED';
      return next(error);
    }

    // 2. Admin role bypasses ownership checks
    if (adminBypass && req.user.is_admin === true) {
      return next();
    }

    // 3. Hook-based resolution (for complex ownership like posts, comments, etc.)
    if (resourceType) {
      if (req.isOwner == null) {
        const hook = req.app.get('container').resolve('hook');
        if (hook && hook.has(HOOK_CHANNEL)) {
          await hook(HOOK_CHANNEL).invoke('resolve', req, { resourceType });
        }
      }

      // Hook should set `req.isOwner` to true/false
      if (req.isOwner === true) {
        return next();
      }

      // If hook resolved and user is not owner, deny
      if (req.isOwner === false) {
        const error = new Error(
          `Access denied: you do not own this ${resourceType}`,
        );
        error.name = 'ForbiddenError';
        error.status = 403;
        error.code = 'OWNERSHIP_REQUIRED';
        return next(error);
      }
    }

    // 4. Param-based resolution (simple ID comparison)
    const resourceOwnerId = req.params[param];
    const userId = String(req.user[userIdField]);

    if (resourceOwnerId && String(resourceOwnerId) === userId) {
      return next();
    }

    // 5. Ownership denied
    const error = new Error('Access denied: you do not own this resource');
    error.name = 'ForbiddenError';
    error.status = 403;
    error.code = 'OWNERSHIP_REQUIRED';
    return next(error);
  };
}

/**
 * Middleware for flexible ownership — tries multiple strategies in order.
 * Access is granted if ANY strategy resolves ownership successfully.
 *
 * Each strategy uses the same options shape as `requireOwnership`:
 * - `param` (string): route param name for param-based check
 * - `userIdField` (string): field on `req.user` to compare against
 * - `resourceType` (string): triggers hook-based resolution
 *
 * @param {Object} [options={}] - Configuration options
 * @param {Array<Object>} [options.strategies=[]] - Ownership strategies to try, in order
 * @param {boolean} [options.adminBypass=true] - Whether admin role bypasses all checks
 * @returns {Function} Express middleware
 *
 * @example
 * // Allow access if user owns the post OR is the team lead
 * router.put('/posts/:id', requireFlexibleOwnership({
 *   strategies: [
 *     { param: 'id', resourceType: 'post' },
 *     { param: 'id', resourceType: 'team_post' },
 *   ],
 * }), controller.update);
 *
 * // Mix param-based and hook-based
 * router.put('/users/:userId/posts/:postId', requireFlexibleOwnership({
 *   strategies: [
 *     { param: 'userId' },
 *     { param: 'postId', resourceType: 'post' },
 *   ],
 * }), controller.update);
 */
export function requireFlexibleOwnership(options = {}) {
  const { strategies = [], adminBypass = true } = options;

  return async (req, res, next) => {
    // 1. Check if user is authenticated
    if (!req.user) {
      const error = new Error('User not authenticated');
      error.name = 'AuthenticationRequiredError';
      error.status = 401;
      error.code = 'AUTH_REQUIRED';
      return next(error);
    }

    // 2. Admin role bypasses ownership checks
    if (adminBypass && req.user.is_admin === true) {
      return next();
    }

    // 3. Try each strategy in order — first match wins
    for (const strategy of strategies) {
      const { param = 'userId', userIdField = 'id', resourceType } = strategy;

      // Hook-based resolution
      if (resourceType) {
        // Reset ownership state so each strategy gets a fresh hook resolution
        req.isOwner = undefined;

        const hook = req.app.get('container').resolve('hook');
        if (hook && hook.has(HOOK_CHANNEL)) {
          await hook(HOOK_CHANNEL).invoke('resolve', req, { resourceType });
        }
        if (req.isOwner === true) {
          return next();
        }
      }

      // Param-based resolution
      const resourceOwnerId = req.params[param];
      if (
        resourceOwnerId &&
        String(resourceOwnerId) === String(req.user[userIdField])
      ) {
        return next();
      }
    }

    // 4. All strategies exhausted — deny
    const error = new Error('Access denied: ownership could not be verified');
    error.name = 'ForbiddenError';
    error.status = 403;
    error.code = 'OWNERSHIP_REQUIRED';
    return next(error);
  };
}

/**
 * Middleware to check if user is one of multiple shared owners of a resource.
 *
 * Uses the `auth.shared_ownership` hook channel so modules can populate
 * `req.sharedOwners` (an array of user IDs) from e.g. a pivot/collaborators table.
 *
 * @param {Object} [options={}] - Configuration options
 * @param {string} options.resourceType - Resource type for hook resolution (required)
 * @param {string} [options.userIdField='id'] - Field on `req.user` to match against
 * @param {boolean} [options.adminBypass=true] - Whether admin role bypasses the check
 * @returns {Function} Express middleware
 *
 * @example
 * // Hook listener in a module (e.g. documents module init):
 * app.get('container').resolve('hook')('auth.shared_ownership').on('resolve', async (req, { resourceType }) => {
 *   if (resourceType === 'document') {
 *     const doc = await Document.findByPk(req.params.id, { include: 'collaborators' });
 *     req.sharedOwners = doc.collaborators.map(c => c.userId);
 *   }
 * });
 *
 * // Route usage:
 * router.put('/documents/:id',
 *   requireSharedOwnership({ resourceType: 'document' }),
 *   controller.update,
 * );
 */
export function requireSharedOwnership(options = {}) {
  const { resourceType, userIdField = 'id', adminBypass = true } = options;

  return async (req, res, next) => {
    // 1. Check if user is authenticated
    if (!req.user) {
      const error = new Error('User not authenticated');
      error.name = 'AuthenticationRequiredError';
      error.status = 401;
      error.code = 'AUTH_REQUIRED';
      return next(error);
    }

    // 2. Admin role bypasses ownership checks
    if (adminBypass && req.user.is_admin === true) {
      return next();
    }

    // 3. Emit hook to populate req.sharedOwners
    if (!req.sharedOwners) {
      const hook = req.app.get('container').resolve('hook');
      if (hook && hook.has(SHARED_HOOK_CHANNEL)) {
        await hook(SHARED_HOOK_CHANNEL).invoke('resolve', req, {
          resourceType,
        });
      }
    }

    // 4. Check if user is among shared owners
    const sharedOwners = (req.sharedOwners || []).map(String);
    const userId = String(req.user[userIdField]);

    if (sharedOwners.includes(userId)) {
      return next();
    }

    // 5. Shared ownership denied
    const error = new Error(
      `Access denied: you are not a shared owner of this ${resourceType || 'resource'}`,
    );
    error.name = 'ForbiddenError';
    error.status = 403;
    error.code = 'SHARED_OWNERSHIP_REQUIRED';
    return next(error);
  };
}

/**
 * Middleware for hierarchical ownership — allows access if user is the owner
 * or an ancestor (e.g. manager, director) in the resource owner's hierarchy.
 *
 * Uses the `auth.hierarchical_ownership` hook channel so modules can populate
 * `req.ownerChain` (an array of user IDs from the resource owner up through
 * the management/organizational chain).
 *
 * Access is granted if the user's ID appears anywhere in `req.ownerChain`.
 *
 * @param {Object} [options={}] - Configuration options
 * @param {string} options.resourceType - Resource type for hook resolution (required)
 * @param {string} [options.userIdField='id'] - Field on `req.user` to match against
 * @param {boolean} [options.adminBypass=true] - Whether admin role bypasses the check
 * @returns {Function} Express middleware
 *
 * @example
 * // Hook listener populates the chain: [owner, manager, director]
 * app.get('container').resolve('hook')('auth.hierarchical_ownership').on('resolve', async (req, { resourceType }) => {
 *   if (resourceType === 'report') {
 *     const report = await Report.findByPk(req.params.id);
 *     req.ownerChain = await getManagementChain(report.authorId);
 *     // e.g. ['author-id', 'manager-id', 'director-id']
 *   }
 * });
 *
 * // Route: director can access reports written by anyone in their chain
 * router.get('/reports/:id',
 *   requireHierarchicalOwnership({ resourceType: 'report' }),
 *   controller.view,
 * );
 */
export function requireHierarchicalOwnership(options = {}) {
  const { resourceType, userIdField = 'id', adminBypass = true } = options;

  return async (req, res, next) => {
    // 1. Check if user is authenticated
    if (!req.user) {
      const error = new Error('User not authenticated');
      error.name = 'AuthenticationRequiredError';
      error.status = 401;
      error.code = 'AUTH_REQUIRED';
      return next(error);
    }

    // 2. Admin role bypasses ownership checks
    if (adminBypass && req.user.is_admin === true) {
      return next();
    }

    // 3. Emit hook to populate req.ownerChain
    const hook = req.app.get('container').resolve('hook');
    if (hook && hook.has(HIERARCHICAL_HOOK_CHANNEL)) {
      await hook(HIERARCHICAL_HOOK_CHANNEL).invoke('resolve', req, {
        resourceType,
      });
    }

    // 4. Check if user appears in the ownership chain
    const ownerChain = (req.ownerChain || []).map(String);
    const userId = String(req.user[userIdField]);

    if (ownerChain.includes(userId)) {
      return next();
    }

    // 5. Hierarchical ownership denied
    const error = new Error(
      `Access denied: you are not in the ownership hierarchy of this ${resourceType || 'resource'}`,
    );
    error.name = 'ForbiddenError';
    error.status = 403;
    error.code = 'HIERARCHICAL_OWNERSHIP_REQUIRED';
    return next(error);
  };
}

/**
 * Middleware for time-based ownership — allows access only if the user
 * owns the resource AND the access window hasn't expired.
 *
 * Uses the `auth.time_based_ownership` hook channel so modules can populate:
 * - `req.isOwner` (boolean) — whether user owns the resource
 * - `req.ownershipExpiresAt` (Date|number) — when ownership access expires
 *
 * @param {Object} [options={}] - Configuration options
 * @param {string} options.resourceType - Resource type for hook resolution (required)
 * @param {number} [options.windowMs] - Default time window in ms, passed to hook as context
 * @param {string} [options.userIdField='id'] - Field on `req.user` to match against
 * @param {boolean} [options.adminBypass=true] - Whether admin role bypasses the check
 * @returns {Function} Express middleware
 *
 * @example
 * // Posts can only be edited within 24 hours of creation
 * router.put('/posts/:id',
 *   requireTimeBasedOwnership({
 *     resourceType: 'post',
 *     windowMs: 24 * 60 * 60 * 1000, // 24 hours
 *   }),
 *   controller.update,
 * );
 *
 * // Hook listener resolves ownership + computes expiry
 * app.get('container').resolve('hook')('auth.time_based_ownership').on('resolve', async (req, ctx) => {
 *   if (ctx.resourceType === 'post') {
 *     const post = await Post.findByPk(req.params.id);
 *     req.isOwner = String(post.authorId) === String(req.user.id);
 *     req.ownershipExpiresAt = new Date(post.createdAt.getTime() + ctx.windowMs);
 *   }
 * });
 */
export function requireTimeBasedOwnership(options = {}) {
  const { resourceType, windowMs, adminBypass = true } = options;

  return async (req, _res, next) => {
    // 1. Check if user is authenticated
    if (!req.user) {
      const error = new Error('User not authenticated');
      error.name = 'AuthenticationRequiredError';
      error.status = 401;
      error.code = 'AUTH_REQUIRED';
      return next(error);
    }

    // 2. Admin role bypasses all checks
    if (adminBypass && req.user.is_admin === true) {
      return next();
    }

    // 3. Emit hook to resolve ownership + expiry
    const hook = req.app.get('container').resolve('hook');
    if (hook && hook.has(TIME_BASED_HOOK_CHANNEL)) {
      await hook(TIME_BASED_HOOK_CHANNEL).invoke('resolve', req, {
        resourceType,
        windowMs,
      });
    }

    // 4. Check ownership
    if (req.isOwner !== true) {
      const error = new Error(
        `Access denied: you do not own this ${resourceType || 'resource'}`,
      );
      error.name = 'ForbiddenError';
      error.status = 403;
      error.code = 'OWNERSHIP_REQUIRED';
      return next(error);
    }

    // 5. Check time window
    const expiresAt = req.ownershipExpiresAt;
    if (expiresAt != null) {
      const now = Date.now();
      const expiryTime =
        expiresAt instanceof Date ? expiresAt.getTime() : expiresAt;

      if (now > expiryTime) {
        const error = new Error(
          `Access window has expired for this ${resourceType || 'resource'}`,
        );
        error.name = 'ForbiddenError';
        error.status = 403;
        error.code = 'OWNERSHIP_EXPIRED';
        return next(error);
      }
    }

    return next();
  };
}
