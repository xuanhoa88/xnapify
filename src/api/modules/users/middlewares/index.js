/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Role-based middlewares
export {
  requireRole,
  requireAnyRole,
  requireAdmin,
  requireModerator,
  requireRoleLevel,
  requireDynamicRole,
} from './role.middleware';

// Permission-based middlewares
export {
  requirePermission,
  requirePermissions,
  requireAnyPermission,
  requireResourcePermission,
  requireConditionalPermission,
} from './permission.middleware';

// Group-based middlewares
export {
  requireGroup,
  requireAnyGroup,
  requireAllGroups,
  requireGroupLevel,
  requireDepartment,
  requireSameTeam,
  cacheUserGroups,
} from './group.middleware';

// Ownership middlewares
export {
  requireOwnership,
  requireFlexibleOwnership,
  requireSharedOwnership,
  requireHierarchicalOwnership,
  requireTimeBasedOwnership,
} from './ownership.middleware';
