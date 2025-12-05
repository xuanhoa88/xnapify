/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRoles, deleteRole } from '../../../redux';
import s from './Roles.css';

// Map role names to icons for visual consistency
const ROLE_ICONS = Object.freeze({
  admin: '👑',
  moderator: '🎭',
  user: '👤',
  guest: '👁️',
  editor: '✏️',
  viewer: '👀',
});

const getRoleIcon = roleName => {
  return ROLE_ICONS[roleName.toLowerCase()] || '📋';
};

function Roles() {
  const dispatch = useDispatch();
  const { roles, loading, error } = useSelector(state => state.admin.roles);

  useEffect(() => {
    dispatch(fetchRoles({ limit: 100 }));
  }, [dispatch]);

  const handleDelete = useCallback(
    async (roleId, roleName) => {
      if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
        return;
      }

      const result = await dispatch(deleteRole(roleId));
      if (!result.success) {
        alert(`Failed to delete role: ${result.error}`);
      }
    },
    [dispatch],
  );

  if (loading) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Role Management</h1>
        </div>
        <div className={s.loading}>Loading roles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Role Management</h1>
        </div>
        <div className={s.error}>
          <p>Error loading roles: {error}</p>
          <button
            className={s.addButton}
            onClick={() => dispatch(fetchRoles({ limit: 100 }))}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Role Management</h1>
        <button className={s.addButton}>
          <svg
            width='16'
            height='16'
            viewBox='0 0 16 16'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M8 3V13M3 8H13'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          Add Role
        </button>
      </div>

      <div className={s.grid}>
        {roles.map(role => (
          <div key={role.id} className={s.roleCard}>
            <div className={s.roleHeader}>
              <div className={s.roleIcon}>{getRoleIcon(role.name)}</div>
              <h3 className={s.roleName}>{role.name}</h3>
            </div>
            <p className={s.roleDescription}>
              {role.description || 'No description available'}
            </p>
            <div className={s.roleStats}>
              <div className={s.stat}>
                <span className={s.statLabel}>Users:</span>
                <span className={s.statValue}>{role.usersCount || 0}</span>
              </div>
              <div className={s.stat}>
                <span className={s.statLabel}>Permissions:</span>
                <span className={s.statValue}>
                  {role.permissionsCount || 0}
                </span>
              </div>
            </div>
            <div className={s.roleActions}>
              <button className={s.editBtn}>Edit</button>
              <button
                className={s.deleteBtn}
                onClick={() => handleDelete(role.id, role.name)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {roles.length === 0 && (
        <div className={s.empty}>
          <p>No roles found.</p>
        </div>
      )}
    </div>
  );
}

export default Roles;
