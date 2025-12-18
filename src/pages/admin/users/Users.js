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
  fetchRoles,
} from '../../../redux';
import { useHistory } from '../../../components/History';
import {
  SearchableSelect,
  useSearchableSelect,
} from '../../../components/SearchableSelect';
import UserBulkActionsBar from './components/UserBulkActionsBar';
import UserActionsDropdown from './components/UserActionsDropdown';
import UserRolesModal from './components/UserRolesModal';
import UserGroupsModal from './components/UserGroupsModal';
import UserPermissionsModal from './components/UserPermissionsModal';
import s from './Users.css';

const getInitials = displayName => {
  if (!displayName) return '?';
  const parts = displayName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
};

const getRoleClass = role => {
  const roleClasses = {
    admin: s.roleAdmin,
    moderator: s.roleModerator,
    user: s.roleUser,
  };
  return typeof role === 'string'
    ? roleClasses[role.toLowerCase()]
    : s.roleUser;
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

  // Use hooks for filter dropdowns with caching
  const {
    options: roleOptions,
    loading: rolesLoading,
    loadingMore: rolesLoadingMore,
    hasMore: rolesHasMore,
    handleSearch: handleRoleSearch,
    handleLoadMore: handleRoleLoadMore,
  } = useSearchableSelect({
    fetchFn: params => dispatch(fetchRoles(params)),
    dataKey: 'roles',
    mapOption: r => ({ value: r.name, label: r.name }),
    includeAllOption: true,
    allOptionLabel: 'All Roles',
  });

  const {
    options: groupOptions,
    loading: groupsLoading,
    loadingMore: groupsLoadingMore,
    hasMore: groupsHasMore,
    handleSearch: handleGroupSearch,
    handleLoadMore: handleGroupLoadMore,
  } = useSearchableSelect({
    fetchFn: params => dispatch(fetchGroups(params)),
    dataKey: 'groups',
    mapOption: g => ({ value: g.name, label: g.name }),
    includeAllOption: true,
    allOptionLabel: 'All Groups',
  });

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
  const debounceTimer = useRef(null);

  const handleSearchChange = useCallback(e => {
    const { value } = e.target;
    setInputValue(value);

    // Debounced search - auto-search after 500ms
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setSearch(value);
      setCurrentPage(1);
    }, 500);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSearch(inputValue);
    setCurrentPage(1);
  }, [inputValue]);

  const handleClearAllFilters = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setInputValue('');
    setSearch('');
    setRoleFilter('');
    setGroupFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setInputValue('');
    setSearch('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = search || roleFilter || groupFilter || statusFilter;

  const handleKeyDown = useCallback(
    e => e.key === 'Enter' && handleSearchSubmit(),
    [handleSearchSubmit],
  );
  const handleRoleFilterChange = useCallback(value => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);
  const handleGroupFilterChange = useCallback(value => {
    setGroupFilter(value);
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
    user => rolesModalRef.current && rolesModalRef.current.open(user),
    [],
  );
  const openGroupsModal = useCallback(
    user => groupsModalRef.current && groupsModalRef.current.open(user),
    [],
  );
  const openPermissionsModal = useCallback(
    user =>
      permissionsModalRef.current && permissionsModalRef.current.open(user),
    [],
  );
  const openBulkRolesModal = useCallback(
    () =>
      rolesModalRef.current && rolesModalRef.current.openBulk(selectedUsers),
    [selectedUsers],
  );
  const openBulkGroupsModal = useCallback(
    () =>
      groupsModalRef.current && groupsModalRef.current.openBulk(selectedUsers),
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
        <UserBulkActionsBar
          count={selectedUsers.length}
          onAssignRoles={openBulkRolesModal}
          onAssignGroups={openBulkGroupsModal}
          onClear={clearSelection}
        />
      )}

      <div className={s.filters}>
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>🔍</span>
          <input
            type='text'
            placeholder='Search users...'
            className={s.searchInput}
            value={inputValue}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
          />
          {inputValue && (
            <button
              className={s.searchClear}
              onClick={handleClearSearch}
              type='button'
              title='Clear search'
            >
              ✕
            </button>
          )}
        </div>
        <div className={s.filterSearchableSelect}>
          <SearchableSelect
            options={roleOptions}
            value={roleFilter}
            onChange={handleRoleFilterChange}
            onSearch={handleRoleSearch}
            onLoadMore={handleRoleLoadMore}
            hasMore={rolesHasMore}
            loading={rolesLoading}
            loadingMore={rolesLoadingMore}
            placeholder='All Roles'
            searchPlaceholder='Search roles...'
          />
        </div>
        <div className={s.filterSearchableSelect}>
          <SearchableSelect
            options={groupOptions}
            value={groupFilter}
            onChange={handleGroupFilterChange}
            onSearch={handleGroupSearch}
            onLoadMore={handleGroupLoadMore}
            hasMore={groupsHasMore}
            loading={groupsLoading}
            loadingMore={groupsLoadingMore}
            placeholder='All Groups'
            searchPlaceholder='Search groups...'
          />
        </div>
        <select
          className={s.filterSelect}
          value={statusFilter}
          onChange={handleStatusFilterChange}
        >
          <option value=''>All Status</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
        </select>
        <div className={s.filterActions}>
          {hasActiveFilters && (
            <button
              className={s.clearBtn}
              onClick={handleClearAllFilters}
              type='button'
              title='Reset all filters'
            >
              ✕ Clear Filters
            </button>
          )}
        </div>
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
                      <span key={role} className={getRoleClass(role)}>
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className={getRoleClass('user')}>User</span>
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
      <UserRolesModal ref={rolesModalRef} />
      <UserGroupsModal ref={groupsModalRef} />
      <UserPermissionsModal ref={permissionsModalRef} />
    </div>
  );
}

export default Users;
