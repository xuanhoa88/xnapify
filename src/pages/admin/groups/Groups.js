/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../contexts/history';
import {
  fetchGroups,
  getGroups,
  getGroupsLoading,
  getGroupsError,
  deleteGroup,
  fetchRoles,
} from '../../../redux';
import GroupActionsDropdown from './components/GroupActionsDropdown';
import GroupRolesModal from './components/GroupRolesModal';
import GroupPermissionsModal from './components/GroupPermissionsModal';
import s from './Groups.css';

// Helper to get user initials from display name or email
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function Groups() {
  const dispatch = useDispatch();
  const history = useHistory();
  const groups = useSelector(getGroups);
  const loading = useSelector(getGroupsLoading);
  const error = useSelector(getGroupsError);

  // Ref for GroupRolesModal
  const rolesModalRef = useRef();

  // Ref for GroupPermissionsModal
  const permissionsModalRef = useRef();

  // State for managing which dropdown is open
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  useEffect(() => {
    // Fetch groups and roles on component mount
    dispatch(fetchGroups({ page: 1 }));
    dispatch(fetchRoles({ limit: 100 }));
  }, [dispatch]);

  const handleAddGroup = useCallback(() => {
    history.push('/admin/groups/create');
  }, [history]);

  const handleEditGroup = useCallback(
    group => {
      history.push(`/admin/groups/${group.id}/edit`);
    },
    [history],
  );

  const handleViewMembers = useCallback(
    group => {
      history.push(`/admin/groups/${group.id}/members`);
    },
    [history],
  );

  const handleManageRoles = useCallback(group => {
    // Open the roles modal for this group
    rolesModalRef.current && rolesModalRef.current.open(group);
  }, []);

  const handleViewPermissions = useCallback(group => {
    // Open the permissions modal for this group
    permissionsModalRef.current && permissionsModalRef.current.open(group);
  }, []);

  const handleDeleteGroup = useCallback(
    async group => {
      const confirmed = window.confirm(
        `Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`,
      );
      if (confirmed) {
        const result = await dispatch(deleteGroup(group.id));
        if (result.success) {
          // Refresh the groups list
          dispatch(fetchGroups({ page: 1 }));
        } else {
          window.alert(`Failed to delete group: ${result.error}`);
        }
      }
    },
    [dispatch],
  );

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  if (loading && groups.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Group Management</h1>
        </div>
        <div className={s.loading}>Loading groups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Group Management</h1>
        </div>
        <div className={s.error}>Error loading groups: {error}</div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Group Management</h1>
        <button className={s.addButton} onClick={handleAddGroup}>
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
          Add Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className={s.empty}>No groups found</div>
      ) : (
        <div className={s.grid}>
          {groups.map(group => {
            const memberCount = group.memberCount || 0;
            const roleCount = group.roleCount || 0;
            const users = group.users || [];
            const roles = group.roles || [];

            // Show up to 3 user avatars
            const visibleUsers = users.slice(0, 3);
            const remainingUserCount = memberCount - visibleUsers.length;

            // Show up to 3 role badges
            const visibleRoles = roles.slice(0, 3);
            const remainingRoleCount = roleCount - visibleRoles.length;

            return (
              <div key={group.id} className={s.groupCard}>
                <div className={s.groupHeader}>
                  <h3 className={s.groupName}>{group.name}</h3>
                  <div className={s.headerRight}>
                    <div className={s.headerBadges}>
                      <span className={s.memberCount}>
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </span>
                      <span className={s.roleCountBadge}>
                        {roleCount} {roleCount === 1 ? 'role' : 'roles'}
                      </span>
                    </div>
                    <GroupActionsDropdown
                      group={group}
                      isOpen={activeDropdownId === group.id}
                      onToggle={handleToggleDropdown}
                      onViewMembers={handleViewMembers}
                      onManageRoles={handleManageRoles}
                      onViewPermissions={handleViewPermissions}
                      onEdit={handleEditGroup}
                      onDelete={handleDeleteGroup}
                    />
                  </div>
                </div>
                <p className={s.groupDescription}>
                  {group.description || 'No description'}
                </p>

                {/* Roles Section */}
                <div className={s.rolesSection}>
                  <span className={s.sectionLabel}>Roles:</span>
                  <div className={s.roles}>
                    {roles.length > 0 ? (
                      <>
                        {visibleRoles.map(role => (
                          <span key={role.id} className={s.roleBadge}>
                            {role.name}
                          </span>
                        ))}
                        {remainingRoleCount > 0 && (
                          <span className={s.roleBadgeMore}>
                            +{remainingRoleCount}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={s.noRoles}>No roles assigned</span>
                    )}
                  </div>
                </div>

                {/* Members Section */}
                <div className={s.members}>
                  {visibleUsers.length > 0 ? (
                    <>
                      {visibleUsers.map(user => (
                        <div
                          key={user.id}
                          className={s.avatar}
                          title={user.display_name || user.email}
                        >
                          {getInitials(user.display_name || user.email)}
                        </div>
                      ))}
                      {remainingUserCount > 0 && (
                        <div className={s.avatar}>+{remainingUserCount}</div>
                      )}
                    </>
                  ) : (
                    <span className={s.noMembers}>No members yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Group Roles Modal */}
      <GroupRolesModal ref={rolesModalRef} />

      {/* Group Permissions Modal */}
      <GroupPermissionsModal ref={permissionsModalRef} />
    </div>
  );
}

export default Groups;
