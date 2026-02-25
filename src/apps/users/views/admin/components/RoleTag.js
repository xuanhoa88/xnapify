/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import Tag from '../../../../../shared/renderer/components/Tag';
import s from './RoleTag.css';

/**
 * CSS class mapping for role-based styling
 */
const ROLE_CLASS_MAP = {
  admin: s.roleAdmin,
  mod: s.roleModerator,
  moderator: s.roleModerator,
  editor: s.roleUser,
  user: s.roleUser,
};

/**
 * RoleTag component - specialized tag for displaying user roles
 * Automatically determines style based on role name
 */
function RoleTag({ name, className = '' }) {
  const roleLower = typeof name === 'string' ? name.toLowerCase() : '';
  const roleClass = ROLE_CLASS_MAP[roleLower] || s.roleUser;
  const displayName = typeof name === 'string' ? name : String(name);
  const classes = [roleClass, className].filter(Boolean).join(' ');

  return <Tag className={classes}>{displayName}</Tag>;
}

RoleTag.propTypes = {
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default RoleTag;
