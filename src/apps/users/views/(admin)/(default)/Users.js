/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
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
import * as Box from '../../../../../shared/renderer/components/Box';
import Icon from '../../../../../shared/renderer/components/Icon';
import Loader from '../../../../../shared/renderer/components/Loader';
import Table from '../../../../../shared/renderer/components/Table';
import Tag from '../../../../../shared/renderer/components/Tag';
import Button from '../../../../../shared/renderer/components/Button';
import Avatar from '../../../../../shared/renderer/components/Avatar';
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

function Users({ context }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { container } = context;
  const { fetchGroups } = useMemo(() => {
    const { thunks } = container.resolve('groups:admin:state');
    return thunks;
  }, [container]);
  const { fetchRoles } = useMemo(() => {
    const { thunks } = container.resolve('roles:admin:state');
    return thunks;
  }, [container]);

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

  // Bulk selection handled by Table's rowSelection component.

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
          {...(!canCreate && {
            disabled: true,
            title: t(
              'admin:users.noPermissionToCreate',
              'You do not have permission to create users',
            ),
          })}
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
              <Icon name='x' size={12} />
              {t('admin:users.list.clearFilters', 'Clear Filters')}
            </Button>
          )}
        </div>
      </Table.SearchBar>

      <Table
        rowSelection={{
          selectedRowKeys: selectedUsers,
          onChange: keys => setSelectedUsers(keys),
        }}
        columns={[
          {
            title: t('admin:users.list.user', 'User'),
            key: 'user',
            render: (_, user) => (
              <div className={s.userCell}>
                <Avatar
                  name={
                    (user.profile && user.profile.display_name) || user.email
                  }
                  size='small'
                />
                <span>
                  {(user.profile && user.profile.display_name) || user.email}
                  {currentUser && currentUser.id === user.id && (
                    <span className={s.youBadge}>
                      {t('admin:users.list.you', '(You)')}
                    </span>
                  )}
                </span>
              </div>
            ),
          },
          {
            title: t('admin:users.list.email', 'Email'),
            dataIndex: 'email',
          },
          {
            title: t('admin:users.list.roles', 'Roles'),
            key: 'roles',
            render: (_, user) => (
              <Tag.List
                emptyText={t(
                  'admin:users.list.noRolesAssigned',
                  'No roles assigned',
                )}
              >
                {user.roles &&
                  user.roles.length > 0 &&
                  user.roles.map(role => <RoleTag key={role} name={role} />)}
              </Tag.List>
            ),
          },
          {
            title: t('admin:users.list.groups', 'Groups'),
            key: 'groups',
            render: (_, user) => (
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
            ),
          },
          {
            title: t('admin:users.list.status', 'Status'),
            key: 'status',
            render: (_, user) => (
              <Tag variant={user.is_active ? 'success' : 'error'}>
                {user.is_active
                  ? t('admin:users.list.statusActive', 'Active')
                  : t('admin:users.list.statusInactive', 'Inactive')}
              </Tag>
            ),
          },
          {
            title: t('admin:users.list.joined', 'Joined'),
            dataIndex: 'created_at',
            render: date =>
              date ? format(new Date(date), 'MMM dd, yyyy') : '—',
          },
          {
            key: 'actions',
            render: (_, user) => (
              <div className={s.actions}>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  {...(currentUser && currentUser.id === user.id
                    ? {
                        disabled: true,
                        title: t(
                          'admin:users.list.cannotEditSelf',
                          'Cannot edit your own account',
                        ),
                      }
                    : { title: t('admin:users.list.edit', 'Edit') })}
                  onClick={() => history.push(`/admin/users/${user.id}/edit`)}
                >
                  <Icon name='edit' size={16} />
                </Button>
                <Button
                  variant='ghost'
                  size='small'
                  iconOnly
                  {...(currentUser && currentUser.id === user.id
                    ? {
                        disabled: true,
                        title: t(
                          'admin:users.list.cannotDeleteSelf',
                          'Cannot delete your own account',
                        ),
                      }
                    : { title: t('admin:users.list.delete', 'Delete') })}
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
            ),
          },
        ]}
        dataSource={users}
        rowKey='id'
        loading={loading}
        pagination={
          pagination && pagination.pages > 1
            ? {
                current: currentPage,
                pages: pagination.pages,
                total: pagination.total,
                onChange: setCurrentPage,
              }
            : false
        }
        locale={{
          emptyText: (
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
                {...(!canCreate && {
                  disabled: true,
                  title: t(
                    'admin:users.noPermissionToCreate',
                    'You do not have permission to create users',
                  ),
                })}
              >
                {t('admin:users.list.addUser', 'Add User')}
              </Button>
            </Table.Empty>
          ),
        }}
      />

      <UserRolesModal
        ref={rolesModalRef}
        onSuccess={handleRefreshUsers}
        fetchRoles={fetchRoles}
      />
      <UserGroupsModal
        ref={groupsModalRef}
        onSuccess={handleRefreshUsers}
        fetchGroups={fetchGroups}
      />
      <UserPermissionsModal ref={permissionsModalRef} />
      <DeleteUserModal ref={deleteModalRef} onSuccess={handleRefreshUsers} />
      <ChangeStatusUserModal
        ref={changeStatusModalRef}
        onSuccess={handleRefreshUsers}
      />
    </div>
  );
}

Users.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default Users;
