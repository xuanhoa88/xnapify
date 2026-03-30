/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import { useRbac } from './useRbac';

// ========================================================================
// COMPONENT: Rbac
// ========================================================================

/**
 * RBAC Component
 *
 * Conditionally renders children based on user permissions, roles, groups, or ownership.
 *
 * @param {Object} props
 * @param {string|string[]} props.permission - Required permission(s)
 * @param {string|string[]} props.roles - Required role(s)
 * @param {string|string[]} props.groups - Required group(s)
 * @param {string} props.ownerId - Resource owner ID (to check ownership)
 * @param {React.ReactNode} props.fallback - Content to render if unauthorized
 * @param {React.ReactNode} props.children - Content to render if authorized
 */
function Rbac({
  permission,
  roles,
  groups,
  ownerId,
  fallback = null,
  children,
}) {
  const { hasPermission, hasRole, hasGroup, isOwner } = useRbac();

  // Check permissions if provided
  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  // Check roles if provided
  if (roles && !hasRole(roles)) {
    return fallback;
  }

  // Check groups if provided
  if (groups && !hasGroup(groups)) {
    return fallback;
  }

  // Check ownership if provided
  if (ownerId && !isOwner(ownerId)) {
    return fallback;
  }

  return <>{children}</>;
}

Rbac.propTypes = {
  permission: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  roles: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  groups: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  ownerId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  fallback: PropTypes.node,
  children: PropTypes.node,
};

export default Rbac;
