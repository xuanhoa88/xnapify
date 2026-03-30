/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Standard RBAC actions (CRUD + wildcard)
 */
export const DEFAULT_ACTIONS = Object.freeze({
  MANAGE: '*', // Wildcard: full control (all actions)
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
});

/**
 * System resources
 */
export const DEFAULT_RESOURCES = Object.freeze({
  ALL: '*', // Wildcard: all resources (super admin)
  USERS: 'users',
  ROLES: 'roles',
  GROUPS: 'groups',
  PERMISSIONS: 'permissions',
  API_KEYS: 'apiKeys',
  FILES: 'files',
});
