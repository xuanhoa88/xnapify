/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../../../../shared/renderer/components/History';
import {
  SearchableSelect,
  useSearchableSelect,
} from '../../../../../../shared/renderer/components/SearchableSelect';
import {
  Box,
  Icon,
  Loader,
  Table,
  ConfirmModal,
} from '../../../../../../shared/renderer/components/Admin';
import Button from '../../../../../../shared/renderer/components/Button';
import Card from '../../../../../../shared/renderer/components/Card';
import Tag from '../../../../../../shared/renderer/components/Tag';
import Avatar from '../../../../../../shared/renderer/components/Avatar';
import RoleTag from '../../users/components/RoleTag';
import { fetchRoles } from '../../roles/redux';
import {
  fetchGroups,
  getGroups,
  isGroupsListLoading,
  isGroupsListInitialized,
  getGroupsListError,
  getGroupsPagination,
  deleteGroup,
} from '../redux';
import GroupActionsDropdown from '../components/GroupActionsDropdown';
import GroupRolesModal from '../components/GroupRolesModal';
import GroupPermissionsModal from '../components/GroupPermissionsModal';
import GroupUsersModal from '../components/GroupUsersModal';
import s from './Groups.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

function Groups() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const groups = useSelector(getGroups);
  const loading = useSelector(isGroupsListLoading);
  const initialized = useSelector(isGroupsListInitialized);
  const error = useSelector(getGroupsListError);
  const pagination = useSelector(getGroupsPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [search, setSearch] = useState('');

  // Filter state
  const [roleFilter, setRoleFilter] = useState('');

  // Ref for GroupRolesModal
  const rolesModalRef = useRef();

  // Ref for GroupPermissionsModal
  const permissionsModalRef = useRef();

  // Ref for GroupUsersModal
  const usersModalRef = useRef();

  // Ref for DeleteGroupModal
  const deleteModalRef = useRef();

  // State for managing which dropdown is open
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Use hook for role filter with caching
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

  useEffect(() => {
    // Fetch groups on component mount or page/filter/search change
    dispatch(
      fetchGroups({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        role: roleFilter,
        search,
      }),
    );
  }, [dispatch, currentPage, roleFilter, search]);

  // Refresh groups list callback
  const refreshGroups = useCallback(() => {
    dispatch(
      fetchGroups({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        role: roleFilter,
        search,
      }),
    );
  }, [dispatch, currentPage, roleFilter, search]);

  const handleAddGroup = useCallback(() => {
    history.push('/admin/groups/create');
  }, [history]);

  const handleEditGroup = useCallback(
    group => {
      history.push(`/admin/groups/${group.id}/edit`);
    },
    [history],
  );

  const handleViewUsers = useCallback(group => {
    // Open the users modal for this group
    usersModalRef.current && usersModalRef.current.open(group);
  }, []);

  const handleManageRoles = useCallback(group => {
    // Open the roles modal for this group
    rolesModalRef.current && rolesModalRef.current.open(group);
  }, []);

  const handleViewPermissions = useCallback(group => {
    // Open the permissions modal for this group
    permissionsModalRef.current && permissionsModalRef.current.open(group);
  }, []);

  const handleDeleteGroup = useCallback(group => {
    // Open the delete modal for this group
    deleteModalRef.current && deleteModalRef.current.open(group);
  }, []);

  const handleDeleteGroupAction = useCallback(
    item => dispatch(deleteGroup(item.id)),
    [dispatch],
  );

  const getGroupName = useCallback(item => item.name, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  // Search handlers
  const handleSearchChange = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleRoleFilterChange = useCallback(value => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setRoleFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = Boolean(search || roleFilter);

  // Show loading on first fetch (not initialized) or when loading with no data
  if (!initialized || (loading && groups.length === 0)) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='folder' size={24} />}
          title='Group Management'
          subtitle='Organize users into groups for easier access control'
        />
        <Loader variant='cards' message='Loading groups...' />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='folder' size={24} />}
          title='Group Management'
          subtitle='Organize users into groups for easier access control'
        />
        <Table.Error
          title={t('groups.errorLoading', 'Error loading groups')}
          error={error}
          onRetry={refreshGroups}
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='folder' size={24} />}
        title='Group Management'
        subtitle='Organize users into groups for easier access control'
      >
        <Button variant='primary' onClick={handleAddGroup}>
          <Icon name='plus' size={16} />
          Add Group
        </Button>
      </Box.Header>

      {/* Filters */}
      <Table.SearchBar
        className={s.filters}
        value={search}
        onChange={handleSearchChange}
        placeholder='Search groups...'
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
          placeholder='All Roles'
          searchPlaceholder='Search roles...'
        />
        <div className={s.filterActions}>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='small'
              onClick={handleClearFilters}
              type='button'
              title='Reset all filters'
            >
              ✕ Clear Filters
            </Button>
          )}
        </div>
      </Table.SearchBar>

      {groups.length === 0 ? (
        <Table.Empty
          icon='folder'
          title='No groups found'
          description='Create a new group to organize users and assign roles.'
          actionLabel='Add Group'
          onAction={handleAddGroup}
        />
      ) : (
        <div className={s.grid}>
          {groups.map(group => {
            const userCount = group.userCount || 0;
            const roleCount = group.roleCount || 0;
            const users = group.users || [];
            const roles = group.roles || [];

            // Show up to 3 user avatars
            const visibleUsers = users.slice(0, 3);
            const remainingUserCount = userCount - visibleUsers.length;

            // Show up to 3 role badges
            const visibleRoles = roles.slice(0, 3);
            const remainingRoleCount = roleCount - visibleRoles.length;

            return (
              <Card
                key={group.id}
                variant='default'
                interactive
                className={s.groupCard}
              >
                <Card.Header
                  className={s.groupCardHeader}
                  actions={
                    <div className={s.headerRight}>
                      <div className={s.headerBadges}>
                        <Tag variant='info'>
                          {userCount} {userCount === 1 ? 'user' : 'users'}
                        </Tag>
                        <Tag variant='secondary'>
                          {roleCount} {roleCount === 1 ? 'role' : 'roles'}
                        </Tag>
                      </div>
                      <GroupActionsDropdown
                        group={group}
                        isOpen={activeDropdownId === group.id}
                        onToggle={handleToggleDropdown}
                        onViewUsers={handleViewUsers}
                        onManageRoles={handleManageRoles}
                        onViewPermissions={handleViewPermissions}
                        onEdit={handleEditGroup}
                        onDelete={handleDeleteGroup}
                      />
                    </div>
                  }
                >
                  <h3 className={s.groupName}>{group.name}</h3>
                </Card.Header>
                <Card.Body className={s.groupCardBody}>
                  <p className={s.groupDescription}>
                    {group.description || 'No description'}
                  </p>

                  {/* Roles Section */}
                  <div className={s.rolesSection}>
                    <span className={s.sectionLabel}>Roles:</span>
                    <Tag.List emptyText='No roles assigned'>
                      {visibleRoles.map(role => (
                        <RoleTag key={role} name={role} className={s.roleTag} />
                      ))}
                      {remainingRoleCount > 0 && (
                        <Tag variant='neutral' className={s.roleTag}>
                          +{remainingRoleCount}
                        </Tag>
                      )}
                    </Tag.List>
                  </div>

                  {/* Users Section */}
                  <div className={s.usersSection}>
                    <span className={s.usersSectionLabel}>Users:</span>
                    {visibleUsers.length > 0 ? (
                      <div className={s.usersAvatars}>
                        {visibleUsers.map(user => (
                          <Avatar
                            key={user.id}
                            name={user.display_name || user.email}
                            size='small'
                          />
                        ))}
                        {remainingUserCount > 0 && (
                          <Avatar
                            name={`+${remainingUserCount}`}
                            size='small'
                          />
                        )}
                      </div>
                    ) : (
                      <span className={s.noUsers}>No users yet</span>
                    )}
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <Table.Pagination
          currentPage={currentPage}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setCurrentPage}
          loading={loading}
        />
      )}

      {/* Group Roles Modal */}
      <GroupRolesModal ref={rolesModalRef} />

      {/* Group Permissions Modal */}
      <GroupPermissionsModal ref={permissionsModalRef} />

      {/* Group Users Modal */}
      <GroupUsersModal ref={usersModalRef} />

      {/* Delete Confirmation Modal */}
      <ConfirmModal.Delete
        ref={deleteModalRef}
        title='Delete Group'
        getItemName={getGroupName}
        onDelete={handleDeleteGroupAction}
        onSuccess={refreshGroups}
      />
    </div>
  );
}

export default Groups;
