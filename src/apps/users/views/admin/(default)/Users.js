/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import format from 'date-fns/format';
import { getUserProfile } from '../../../../../shared/renderer/redux';
import { useHistory } from '../../../../../shared/renderer/components/History';
import {
  SearchableSelect,
  useSearchableSelect,
} from '../../../../../shared/renderer/components/SearchableSelect';
import { useRbac } from '../../../../../shared/renderer/components/Rbac';
import {
  Box,
  Icon,
  Loader,
  Table,
} from '../../../../../shared/renderer/components/Admin';
import Tag from '../../../../../shared/renderer/components/Tag';
import Button from '../../../../../shared/renderer/components/Button';
import Avatar from '../../../../../shared/renderer/components/Avatar';
import { fetchGroups } from '../../../../groups/views/admin/redux';
import { fetchRoles } from '../../../../roles/views/admin/redux';
import {
  fetchUsers,
  getUsers,
  getUsersPagination,
  isUsersListLoading,
  isUsersListInitialized,
  getUsersListError,
} from '../redux';
import UserActionsDropdown from '../components/UserActionsDropdown';
import UserRolesModal from '../components/UserRolesModal';
import UserGroupsModal from '../components/UserGroupsModal';
import UserPermissionsModal from '../components/UserPermissionsModal';
import DeleteUserModal from '../components/DeleteUserModal';
import ChangeStatusUserModal from '../components/ChangeStatusUserModal';
import RoleTag from '../components/RoleTag';
import GroupTag from '../components/GroupTag';
import s from './Users.css';

function Users() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const { hasPermission } = useRbac();
  const canCreate = hasPermission('users:create');
  const users = useSelector(getUsers);
  const pagination = useSelector(getUsersPagination);
  const loading = useSelector(isUsersListLoading);
  const initialized = useSelector(isUsersListInitialized);
  const error = useSelector(getUsersListError);
  const currentUser = useSelector(getUserProfile);

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
    allOptionLabel: t('admin:users.list.allRoles', 'All Roles'),
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
    allOptionLabel: t('admin:users.list.allGroups', 'All Groups'),
  });

  // Filter state
  const [search, setSearch] = useState('');
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
  const changeStatusModalRef = useRef();

  const clearSelection = useCallback(() => setSelectedUsers([]), []);

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
    // Open the delete modal for single user (wrapped in unified format)
    deleteModalRef.current &&
      deleteModalRef.current.open({
        ids: [user.id],
        items: [user],
      });
  }, []);

  const handleBulkDelete = useCallback(() => {
    deleteModalRef.current &&
      deleteModalRef.current.open({
        ids: selectedUsers,
      });
  }, [selectedUsers]);

  const handleBulkActivate = useCallback(() => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: selectedUsers,
        isActive: true,
      });
  }, [selectedUsers]);

  const handleBulkDeactivate = useCallback(() => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: selectedUsers,
        isActive: false,
      });
  }, [selectedUsers]);

  const handleActivate = useCallback(user => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: [user.id],
        isActive: true,
      });
  }, []);

  const handleDeactivate = useCallback(user => {
    changeStatusModalRef.current &&
      changeStatusModalRef.current.open({
        ids: [user.id],
        isActive: false,
      });
  }, []);

  // Filter handlers
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSearch('');
    setRoleFilter('');
    setGroupFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = search || roleFilter || groupFilter || statusFilter;

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

  const handleRefreshUsers = useCallback(() => {
    clearSelection();
    refreshUsers();
  }, [clearSelection, refreshUsers]);

  // Show loading on first fetch (not initialized) or when loading with no data
  if (!initialized || (loading && users.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='users' size={24} />}
          title={t('admin:users.list.title', 'User Management')}
          subtitle={t(
            'admin:users.list.subtitle',
            'Manage users, roles, and permissions',
          )}
        />
        <Loader
          variant='skeleton'
          message={t('admin:users.list.loadingUsers', 'Loading users...')}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='users' size={24} />}
          title={t('admin:users.list.title', 'User Management')}
          subtitle={t(
            'admin:users.list.subtitle',
            'Manage users, roles, and permissions',
          )}
        />
        <Table.Error
          title={t('admin:users.errors.loadUsers', 'Error loading users')}
          error={error}
          onRetry={refreshUsers}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='users' size={24} />}
        title={t('admin:users.list.title', 'User Management')}
        subtitle={t(
          'admin:users.list.subtitle',
          'Manage users, roles, and permissions',
        )}
      >
        <Button
          variant='primary'
          onClick={() => history.push('/admin/users/create')}
          disabled={!canCreate}
          title={
            !canCreate
              ? t(
                  'admin:users.noPermissionToCreate',
                  'You do not have permission to create users',
                )
              : undefined
          }
        >
          {t('admin:users.list.addUser', 'Add User')}
        </Button>
      </Box.Header>

      {selectedUsers.length > 0 && (
        <Table.BulkActionsBar
          count={selectedUsers.length}
          actions={[
            {
              label: t('admin:users.list.assignRoles', 'Assign Roles'),
              onClick: openBulkRolesModal,
            },
            {
              label: t('admin:users.list.assignGroups', 'Assign Groups'),
              onClick: openBulkGroupsModal,
            },
          ]}
          moreActions={[
            {
              label: t('admin:users.list.activate', 'Activate'),
              icon: <Icon name='check' size={16} />,
              onClick: handleBulkActivate,
            },
            {
              label: t('admin:users.list.deactivate', 'Deactivate'),
              icon: <Icon name='close' size={16} />,
              variant: 'warning',
              onClick: handleBulkDeactivate,
            },
            { type: 'divider' },
            {
              label: t('admin:users.list.delete', 'Delete'),
              icon: <Icon name='trash' size={16} />,
              variant: 'danger',
              onClick: handleBulkDelete,
            },
          ]}
          onClear={clearSelection}
        />
      )}

      <Table.SearchBar
        className={s.filters}
        value={search}
        onChange={handleSearchChange}
        placeholder={t('admin:users.list.searchUsers', 'Search users...')}
      >
        <SearchableSelect
          className={s.filterSearchableSelect}
          options={roleOptions}
          value={roleFilter}
          onChange={handleRoleFilterChange}
          onSearch={handleRoleSearch}
          onLoadMore={handleRoleLoadMore}
          hasMore={rolesHasMore}
          loading={rolesLoading}
          loadingMore={rolesLoadingMore}
          placeholder={t('admin:users.list.allRoles', 'All Roles')}
          searchPlaceholder={t(
            'admin:users.list.searchRoles',
            'Search roles...',
          )}
        />
        <SearchableSelect
          className={s.filterSearchableSelect}
          options={groupOptions}
          value={groupFilter}
          onChange={handleGroupFilterChange}
          onSearch={handleGroupSearch}
          onLoadMore={handleGroupLoadMore}
          hasMore={groupsHasMore}
          loading={groupsLoading}
          loadingMore={groupsLoadingMore}
          placeholder={t('admin:users.list.allGroups', 'All Groups')}
          searchPlaceholder={t(
            'admin:users.list.searchGroups',
            'Search groups...',
          )}
        />
        <SearchableSelect
          className={s.filterSearchableSelect}
          options={[
            { value: '', label: t('admin:users.list.allStatus', 'All Status') },
            {
              value: 'active',
              label: t('admin:users.list.statusActive', 'Active'),
            },
            {
              value: 'inactive',
              label: t('admin:users.list.statusInactive', 'Inactive'),
            },
          ]}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          placeholder={t('admin:users.list.allStatus', 'All Status')}
          showSearch={false}
        />
        <div className={s.filterActions}>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='small'
              onClick={handleClearAllFilters}
              type='button'
              title={t('admin:users.list.resetAllFilters', 'Reset all filters')}
            >
              ✕ {t('admin:users.list.clearFilters', 'Clear Filters')}
            </Button>
          )}
        </div>
      </Table.SearchBar>

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
              <th>{t('admin:users.list.user', 'User')}</th>
              <th>{t('admin:users.list.email', 'Email')}</th>
              <th>{t('admin:users.list.roles', 'Roles')}</th>
              <th>{t('admin:users.list.groups', 'Groups')}</th>
              <th>{t('admin:users.list.status', 'Status')}</th>
              <th>{t('admin:users.list.joined', 'Joined')}</th>
              <th />
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
                    <Avatar
                      name={
                        (user.profile && user.profile.display_name) ||
                        user.email
                      }
                      size='small'
                    />
                    <span>
                      {(user.profile && user.profile.display_name) ||
                        user.email}
                      {currentUser && currentUser.id === user.id && (
                        <span className={s.youBadge}>
                          {t('admin:users.list.you', '(You)')}
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <Tag.List
                    emptyText={t(
                      'admin:users.list.noRolesAssigned',
                      'No roles assigned',
                    )}
                  >
                    {user.roles &&
                      user.roles.length > 0 &&
                      user.roles.map(role => (
                        <RoleTag key={role} name={role} />
                      ))}
                  </Tag.List>
                </td>
                <td>
                  <Tag.List
                    emptyText={t(
                      'admin:users.list.noGroupsAssigned',
                      'No groups assigned',
                    )}
                  >
                    {user.groups &&
                      user.groups.map(group => (
                        <GroupTag key={group.id} name={group.name} />
                      ))}
                  </Tag.List>
                </td>
                <td>
                  <Tag variant={user.is_active ? 'success' : 'error'}>
                    {user.is_active
                      ? t('admin:users.list.statusActive', 'Active')
                      : t('admin:users.list.statusInactive', 'Inactive')}
                  </Tag>
                </td>
                <td>
                  {user.created_at
                    ? format(new Date(user.created_at), 'MMM dd, yyyy')
                    : '—'}
                </td>
                <td>
                  <div className={s.actions}>
                    <Button
                      variant='ghost'
                      size='small'
                      iconOnly
                      title={
                        currentUser && currentUser.id === user.id
                          ? t(
                              'admin:users.list.cannotEditSelf',
                              'Cannot edit your own account',
                            )
                          : t('admin:users.list.edit', 'Edit')
                      }
                      disabled={currentUser && currentUser.id === user.id}
                      onClick={() =>
                        history.push(`/admin/users/${user.id}/edit`)
                      }
                    >
                      <Icon name='edit' size={16} />
                    </Button>
                    <Button
                      variant='ghost'
                      size='small'
                      iconOnly
                      title={
                        currentUser && currentUser.id === user.id
                          ? t(
                              'admin:users.list.cannotDeleteSelf',
                              'Cannot delete your own account',
                            )
                          : t('admin:users.list.delete', 'Delete')
                      }
                      disabled={currentUser && currentUser.id === user.id}
                      onClick={() => handleDelete(user)}
                    >
                      <Icon name='trash' size={16} />
                    </Button>
                    <UserActionsDropdown
                      user={user}
                      isOpen={activeDropdownId === user.id}
                      onToggle={id =>
                        setActiveDropdownId(prev => (prev === id ? null : id))
                      }
                      onManageRoles={openRolesModal}
                      onManageGroups={openGroupsModal}
                      onViewPermissions={openPermissionsModal}
                      onActivate={handleActivate}
                      onDeactivate={handleDeactivate}
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
          title={t('admin:users.list.noUsersFound', 'No users found')}
          description={t(
            'admin:users.list.noUsersFoundDescription',
            'Try adjusting your search or filter criteria, or add a new user to get started.',
          )}
        >
          <Button
            variant='primary'
            onClick={() => history.push('/admin/users/create')}
            disabled={!canCreate}
            title={
              !canCreate
                ? t(
                    'admin:users.noPermissionToCreate',
                    'You do not have permission to create users',
                  )
                : undefined
            }
          >
            {t('admin:users.list.addUser', 'Add User')}
          </Button>
        </Table.Empty>
      )}

      {pagination && pagination.pages > 1 && (
        <Table.Pagination
          currentPage={currentPage}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setCurrentPage}
        />
      )}

      <UserRolesModal ref={rolesModalRef} onSuccess={handleRefreshUsers} />
      <UserGroupsModal ref={groupsModalRef} onSuccess={handleRefreshUsers} />
      <UserPermissionsModal ref={permissionsModalRef} />
      <DeleteUserModal ref={deleteModalRef} onSuccess={handleRefreshUsers} />
      <ChangeStatusUserModal
        ref={changeStatusModalRef}
        onSuccess={handleRefreshUsers}
      />
    </div>
  );
}

export default Users;
