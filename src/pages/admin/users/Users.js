/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import {
  fetchUsers,
  deleteUser,
  getUsers,
  getUsersPagination,
  getUsersLoading,
  getUsersError,
  fetchGroups,
  getGroups,
  fetchRoles,
  getRoles,
} from '../../../redux';
import { useHistory } from '../../../contexts/history';
import {
  BulkActionsBar,
  UserActionsDropdown,
  RolesModal,
  GroupsModal,
  PermissionsModal,
} from './components';
import s from './Users.css';

const getInitials = displayName => {
  if (!displayName) return '?';
  const parts = displayName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
};

const formatDate = dateString => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function Users() {
  const dispatch = useDispatch();
  const history = useHistory();
  const users = useSelector(getUsers);
  const pagination = useSelector(getUsersPagination);
  const loading = useSelector(getUsersLoading);
  const error = useSelector(getUsersError);
  const groups = useSelector(getGroups);
  const roles = useSelector(getRoles);

  // Filter state
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Modal refs
  const rolesModalRef = useRef();
  const groupsModalRef = useRef();
  const permissionsModalRef = useRef();

  useEffect(() => {
    dispatch(fetchGroups());
    dispatch(fetchRoles());
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      fetchUsers({
        page: currentPage,
        search,
        role: roleFilter,
        group: groupFilter,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, roleFilter, groupFilter, statusFilter]);

  const refreshUsers = useCallback(() => {
    dispatch(
      fetchUsers({
        page: currentPage,
        search,
        role: roleFilter,
        group: groupFilter,
        status: statusFilter,
      }),
    );
  }, [dispatch, currentPage, search, roleFilter, groupFilter, statusFilter]);

  const handleDelete = useCallback(
    async (userId, userEmail) => {
      if (!confirm(`Are you sure you want to delete user "${userEmail}"?`)) {
        return;
      }
      const result = await dispatch(deleteUser(userId));
      if (!result.success) {
        alert(`Failed to delete user: ${result.error}`);
      }
    },
    [dispatch],
  );

  // Filter handlers
  const handleSearchChange = useCallback(
    e => setInputValue(e.target.value),
    [],
  );
  const handleSearchSubmit = useCallback(() => {
    if (inputValue !== search) {
      setSearch(inputValue);
      setCurrentPage(1);
    }
  }, [inputValue, search]);
  const handleKeyDown = useCallback(
    e => e.key === 'Enter' && handleSearchSubmit(),
    [handleSearchSubmit],
  );
  const handleRoleFilterChange = useCallback(e => {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  }, []);
  const handleGroupFilterChange = useCallback(e => {
    setGroupFilter(e.target.value);
    setCurrentPage(1);
  }, []);
  const handleStatusFilterChange = useCallback(e => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  }, []);

  // Bulk selection
  const handleSelectAll = useCallback(
    e => {
      setSelectedUsers(e.target.checked ? users.map(u => u.id) : []);
    },
    [users],
  );
  const handleSelectUser = useCallback((userId, checked) => {
    setSelectedUsers(prev =>
      checked ? [...prev, userId] : prev.filter(id => id !== userId),
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedUsers([]), []);

  // Modal handlers
  const openRolesModal = useCallback(
    user => rolesModalRef.current?.open(user),
    [],
  );
  const openGroupsModal = useCallback(
    user => groupsModalRef.current?.open(user),
    [],
  );
  const openPermissionsModal = useCallback(
    user => permissionsModalRef.current?.open(user),
    [],
  );
  const openBulkRolesModal = useCallback(
    () => rolesModalRef.current?.openBulk(selectedUsers),
    [selectedUsers],
  );
  const openBulkGroupsModal = useCallback(
    () => groupsModalRef.current?.openBulk(selectedUsers),
    [selectedUsers],
  );

  if (loading && users.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>User Management</h1>
        </div>
        <div className={s.loading}>Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>User Management</h1>
        </div>
        <div className={s.error}>
          <p>Error loading users: {error}</p>
          <button className={s.addButton} onClick={refreshUsers}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h2 className={s.title}>User Management</h2>
        <button
          className={s.addButton}
          onClick={() => history.push('/admin/users/create')}
        >
          Add User
        </button>
      </div>

      {selectedUsers.length > 0 && (
        <BulkActionsBar
          count={selectedUsers.length}
          onAssignRoles={openBulkRolesModal}
          onAssignGroups={openBulkGroupsModal}
          onClear={clearSelection}
        />
      )}

      <div className={s.filters}>
        <input
          type='text'
          placeholder='Search users... (Press Enter)'
          className={s.searchInput}
          value={inputValue}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSearchSubmit}
        />
        <select
          className={s.filterSelect}
          value={roleFilter}
          onChange={handleRoleFilterChange}
        >
          <option value=''>All Roles</option>
          {roles.map(role => (
            <option key={role.id} value={role.name}>
              {role.name}
            </option>
          ))}
        </select>
        <select
          className={s.filterSelect}
          value={groupFilter}
          onChange={handleGroupFilterChange}
        >
          <option value=''>All Groups</option>
          {groups.map(group => (
            <option key={group.id} value={group.name}>
              {group.name}
            </option>
          ))}
        </select>
        <select
          className={s.filterSelect}
          value={statusFilter}
          onChange={handleStatusFilterChange}
        >
          <option value=''>All Status</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
        </select>
      </div>

      <div className={s.tableContainer}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.checkboxCol}>
                <input
                  type='checkbox'
                  className={s.checkbox}
                  checked={
                    selectedUsers.length === users.length && users.length > 0
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Groups</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td className={s.checkboxCol}>
                  <input
                    type='checkbox'
                    className={s.checkbox}
                    checked={selectedUsers.includes(user.id)}
                    onChange={e => handleSelectUser(user.id, e.target.checked)}
                  />
                </td>
                <td>
                  <div className={s.userCell}>
                    <div className={s.avatar}>
                      {getInitials(user.display_name || user.email)}
                    </div>
                    <span>{user.display_name || user.email}</span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map(role => (
                      <span
                        key={role}
                        className={clsx(
                          s.roleUser,
                          s[
                            `role${role.charAt(0).toUpperCase() + role.slice(1)}`
                          ],
                        )}
                      >
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className={s.roleUser}>User</span>
                  )}
                </td>
                <td>
                  {user.groups && user.groups.length > 0 ? (
                    user.groups.map(group => (
                      <span key={group.id} className={s.groupBadge}>
                        {group.name}
                      </span>
                    ))
                  ) : (
                    <span className={s.noGroup}>—</span>
                  )}
                </td>
                <td>
                  <span
                    className={
                      user.is_active ? s.statusActive : s.statusInactive
                    }
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{formatDate(user.created_at)}</td>
                <td>
                  <div className={s.actions}>
                    <button
                      className={s.actionBtn}
                      title='Edit'
                      onClick={() =>
                        history.push(`/admin/users/${user.id}/edit`)
                      }
                    >
                      ✏️
                    </button>
                    <button
                      className={s.actionBtn}
                      title='Delete'
                      onClick={() => handleDelete(user.id, user.email)}
                    >
                      🗑️
                    </button>
                    <UserActionsDropdown
                      user={user}
                      isOpen={activeDropdownId === user.id}
                      onToggle={id =>
                        setActiveDropdownId(prev => (prev === id ? null : id))
                      }
                      onManageRoles={openRolesModal}
                      onManageGroups={openGroupsModal}
                      onViewPermissions={openPermissionsModal}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className={s.empty}>
          <p>No users found.</p>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className={s.pagination}>
          <button
            className={s.pageBtn}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          <div className={s.pageNumbers}>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1)
              .filter(
                i =>
                  i === 1 ||
                  i === pagination.pages ||
                  Math.abs(i - currentPage) <= 1,
              )
              .map((i, idx, arr) => (
                <span key={i}>
                  {idx > 0 && arr[idx - 1] < i - 1 && (
                    <span className={s.ellipsis}>...</span>
                  )}
                  <button
                    className={clsx(s.pageNumber, {
                      [s.activePage]: currentPage === i,
                    })}
                    onClick={() => setCurrentPage(i)}
                  >
                    {i}
                  </button>
                </span>
              ))}
          </div>
          <button
            className={s.pageBtn}
            disabled={currentPage >= pagination.pages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Modals - self-contained with ref-based API */}
      <RolesModal ref={rolesModalRef} />
      <GroupsModal ref={groupsModalRef} />
      <PermissionsModal ref={permissionsModalRef} />
    </div>
  );
}

export default Users;
