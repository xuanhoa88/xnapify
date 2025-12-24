/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from '../../../components/History';
import {
  fetchGroups,
  getGroups,
  getGroupsLoading,
  getGroupsError,
  getGroupsPagination,
  fetchRoles,
  deleteGroup,
} from '../../../redux';
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
import GroupActionsDropdown from './components/GroupActionsDropdown';
import GroupRolesModal from './components/GroupRolesModal';
import GroupPermissionsModal from './components/GroupPermissionsModal';
import GroupUsersModal from './components/GroupUsersModal';
import s from './Groups.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

// Helper to get user initials from display name or email
const getInitials = name => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

function Groups() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const groups = useSelector(getGroups);
  const loading = useSelector(getGroupsLoading);
  const error = useSelector(getGroupsError);
  const pagination = useSelector(getGroupsPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');

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

  // Debounce timer ref
  const debounceTimer = useRef(null);

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

  const handleClearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setInputValue('');
    setSearch('');
    setCurrentPage(1);
  }, []);

  const handleKeyDown = useCallback(
    e => e.key === 'Enter' && handleSearchSubmit(),
    [handleSearchSubmit],
  );

  const handleRoleFilterChange = useCallback(value => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setInputValue('');
    setSearch('');
    setRoleFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = Boolean(search || roleFilter);

  if (loading && groups.length === 0) {
    return (
      <div className={s.root}>
        <Page.Header
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
        <Page.Header
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
      <Page.Header
        icon={<Icon name='folder' size={24} />}
        title='Group Management'
        subtitle='Organize users into groups for easier access control'
      >
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
      </Page.Header>

      {/* Filters */}
      <div className={s.filters}>
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            placeholder='Search groups...'
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
        <div className={s.filterItem}>
          <SearchableSelect
            options={roleOptions}
            value={roleFilter}
            onChange={handleRoleFilterChange}
            onSearch={handleRoleSearch}
            onLoadMore={handleRoleLoadMore}
            hasMore={rolesHasMore}
            loading={rolesLoading}
            loadingMore={rolesLoadingMore}
            placeholder='Filter by role...'
            searchPlaceholder='Search roles...'
          />
        </div>
        {hasActiveFilters && (
          <button
            className={s.clearFiltersBtn}
            onClick={handleClearFilters}
            type='button'
            title='Reset all filters'
          >
            ✕ Clear Filters
          </button>
        )}
      </div>

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
              <div key={group.id} className={s.groupCard}>
                <div className={s.groupHeader}>
                  <h3 className={s.groupName}>{group.name}</h3>
                  <div className={s.headerRight}>
                    <div className={s.headerBadges}>
                      <span className={s.userCount}>
                        {userCount} {userCount === 1 ? 'user' : 'users'}
                      </span>
                      <span className={s.roleCountBadge}>
                        {roleCount} {roleCount === 1 ? 'role' : 'roles'}
                      </span>
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

                {/* Users Section */}
                <div className={s.users}>
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
                    <span className={s.noUsers}>No users yet</span>
                  )}
                </div>
              </div>
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
