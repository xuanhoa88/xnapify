/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useSelector } from 'react-redux';

import {
  checkPermission,
  hasRole as checkRole,
  hasGroup as checkGroup,
  isOwner as checkOwner,
} from './middlewares';

// ========================================================================
// HOOK: useRbac
// ========================================================================

/**
 * Custom hook to check user permissions and roles
 *
 * @returns {Object} { hasPermission, hasRole, hasGroup, isOwner, user }
 */
export function useRbac() {
  const user = useSelector(state => state.user.data);

  /**
   * Check if user has ANY of the required permissions
   *
   * @param {string|string[]} permission - Single permission or array of permissions
   * @returns {boolean}
   */
  const hasPermission = permission => {
    if (!permission) return true;
    const permissions = Array.isArray(permission) ? permission : [permission];
    return permissions.some(perm => checkPermission(user, perm));
  };

  /**
   * Check if user has ANY of the required roles
   *
   * @param {string|string[]} role - Single role or array of roles
   * @returns {boolean}
   */
  const hasRole = role => {
    return checkRole(user, role);
  };

  /**
   * Check if user is in ANY of the required groups
   *
   * @param {string|string[]} group - Single group or array of groups
   * @returns {boolean}
   */
  const hasGroup = group => {
    return checkGroup(user, group);
  };

  /**
   * Check if user is the owner of a resource
   *
   * @param {string} resourceOwnerId - ID of the resource owner
   * @returns {boolean}
   */
  const isOwner = resourceOwnerId => {
    return checkOwner(user, resourceOwnerId);
  };

  return { hasPermission, hasRole, hasGroup, isOwner, user };
}

export default useRbac;
