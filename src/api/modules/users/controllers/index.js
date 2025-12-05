/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Export user management controllers (separated for clarity)
export * as authController from './auth.controller';
export * as profileController from './profile.controller';
export * as userAdminController from './user-admin.controller';

// Export RBAC controllers (separated for clarity)
export * as roleController from './role.controller';
export * as permissionController from './permission.controller';
export * as groupController from './group.controller';
export * as userAssignmentController from './user-assignment.controller';
export * as systemController from './system.controller';

// Export dashboard controller
export * as dashboardController from './dashboard.controller';
