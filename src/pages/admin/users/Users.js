/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchUsers,
  getUsers,
  getUsersPagination,
  getUsersLoading,
  getUsersError,
  fetchGroups,
  fetchRoles,
  deleteUser,
} from '../../../redux';
import { useHistory } from '../../../components/History';
import {
  SearchableSelect,
  useSearchableSelect,
} from '../../../components/SearchableSelect';
import {
  Page,
  Icon,
  Loader,
  Table,
  ConfirmModal,
} from '../../../components/Admin';
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
    mod: s.roleModerator,
    moderator: s.roleModerator,
    editor: s.roleUser,
    user: s.roleUser,
  };
  return typeof role === 'string'
    ? roleClasses[role.toLowerCase()] || s.roleUser
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
  const { t } = useTranslation();
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
    onSearch: handleRoleSearch,
    onLoadMore: handleRoleLoadMore,
  } = useSearchableSelect({
    fetch: params => dispatch(fetchRoles(params)),
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
    onSearch: handleGroupSearch,
    onLoadMore: handleGroupLoadMore,
  } = useSearchableSelect({
    fetch: params => dispatch(fetchGroups(params)),
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
  const deleteModalRef = useRef();

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

  const handleDelete = useCallback(user => {
    // Open the delete modal for this user
    deleteModalRef.current && deleteModalRef.current.open(user);
  }, []);

  const handleDeleteUser = useCallback(
    item => dispatch(deleteUser(item.id)),
    [dispatch],
  );

  const getUserDisplayName = useCallback(
    item => item.display_name || item.email,
    [],
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
  const handleStatusFilterChange = useCallback(value => {
    setStatusFilter(value);
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
        <Page.Header
          icon={<Icon name='users' size={24} />}
          title='User Management'
          subtitle='Manage users, roles, and permissions'
        />
        <Loader variant='skeleton' message='Loading users...' />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <Page.Header
          icon={<Icon name='users' size={24} />}
          title='User Management'
          subtitle='Manage users, roles, and permissions'
        />
        <Table.Error
          title={t('users.errorLoading', 'Error loading users')}
          error={error}
          onRetry={refreshUsers}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Page.Header
        icon={<Icon name='users' size={24} />}
        title='User Management'
        subtitle='Manage users, roles, and permissions'
      >
        <button
          className={s.addButton}
          onClick={() => history.push('/admin/users/create')}
        >
          Add User
        </button>
      </Page.Header>

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
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
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
        <SearchableSelect
          className={s.filterSearchableSelect}
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          placeholder='All Status'
          showSearch={false}
        />
        <div className={s.filterActions}>
          {hasActiveFilters && (
            <button
              className={s.clearFiltersBtn}
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
                  <div className={s.rolesCell}>
                    {user.roles && user.roles.length > 0 ? (
                      user.roles.map(role => (
                        <span key={role} className={getRoleClass(role)}>
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className={getRoleClass('user')}>User</span>
                    )}
                  </div>
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
                      <Icon name='edit' size={16} />
                    </button>
                    <button
                      className={s.actionBtn}
                      title='Delete'
                      onClick={() => handleDelete(user)}
                    >
                      <Icon name='trash' size={16} />
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
        <Table.Empty
          icon='users'
          title='No users found'
          description='Try adjusting your search or filter criteria, or add a new user to get started.'
          actionLabel='Add User'
          onAction={() => history.push('/admin/users/create')}
        />
      )}

      {pagination && pagination.pages > 1 && (
        <Table.Pagination
          currentPage={currentPage}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Modals - self-contained with ref-based API */}
      <UserRolesModal ref={rolesModalRef} />
      <UserGroupsModal ref={groupsModalRef} />
      <UserPermissionsModal ref={permissionsModalRef} />
      <ConfirmModal.Delete
        ref={deleteModalRef}
        title='Delete User'
        getItemName={getUserDisplayName}
        onDelete={handleDeleteUser}
        onSuccess={refreshUsers}
      />
    </div>
  );
}

export default Users;
