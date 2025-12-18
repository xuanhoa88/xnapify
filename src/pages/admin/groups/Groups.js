/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { useHistory } from '../../../components/History';
import {
  fetchGroups,
  getGroups,
  getGroupsLoading,
  getGroupsError,
  getGroupsPagination,
  fetchRoles,
} from '../../../redux';
import {
  SearchableSelect,
  useSearchableSelect,
} from '../../../components/SearchableSelect';
import GroupActionsDropdown from './components/GroupActionsDropdown';
import GroupRolesModal from './components/GroupRolesModal';
import GroupPermissionsModal from './components/GroupPermissionsModal';
import DeleteGroupModal from './components/DeleteGroupModal';
import s from './Groups.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

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
  const pagination = useSelector(getGroupsPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state
  const [roleFilter, setRoleFilter] = useState('');

  // Ref for GroupRolesModal
  const rolesModalRef = useRef();

  // Ref for GroupPermissionsModal
  const permissionsModalRef = useRef();

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
    handleSearch: handleRoleSearch,
    handleLoadMore: handleRoleLoadMore,
  } = useSearchableSelect({
    fetchFn: params => dispatch(fetchRoles(params)),
    dataKey: 'roles',
    mapOption: r => ({ value: r.name, label: r.name }),
    includeAllOption: true,
    allOptionLabel: 'All Roles',
  });

  useEffect(() => {
    // Fetch groups on component mount or page/filter change
    dispatch(
      fetchGroups({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        role: roleFilter,
      }),
    );
  }, [dispatch, currentPage, roleFilter]);

  // Refresh groups list callback
  const refreshGroups = useCallback(() => {
    dispatch(
      fetchGroups({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        role: roleFilter,
      }),
    );
  }, [dispatch, currentPage, roleFilter]);

  const handleAddGroup = useCallback(() => {
    history.push('/admin/groups/create');
  }, [history]);

  const handleEditGroup = useCallback(
    group => {
      history.push(`/admin/groups/${group.id}/edit`);
    },
    [history],
  );

  const handleViewUsers = useCallback(
    group => {
      history.push(`/admin/groups/${group.id}/users`);
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

  const handleDeleteGroup = useCallback(group => {
    // Open the delete modal for this group
    deleteModalRef.current && deleteModalRef.current.open(group);
  }, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  const handleRoleFilterChange = useCallback(value => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setRoleFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = Boolean(roleFilter);

  // Pagination handlers
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    const totalPages = (pagination && pagination.pages) || 1;
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, pagination]);

  const handlePageClick = useCallback(page => {
    setCurrentPage(page);
  }, []);

  // Generate page numbers for pagination
  const getPageNumbers = useCallback(() => {
    const totalPages = (pagination && pagination.pages) || 1;
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  }, [currentPage, pagination]);

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

      {/* Filters */}
      <div className={s.filters}>
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
          >
            Clear Filters
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className={s.empty}>No groups found</div>
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
      {pagination && (pagination.pages > 1 || pagination.total > 0) && (
        <div className={s.pagination}>
          <span className={s.paginationInfo}>
            {pagination.total} total · Page {currentPage} of {pagination.pages}
          </span>
          {pagination.pages > 1 && (
            <>
              <button
                className={s.pageBtn}
                onClick={handlePrevPage}
                disabled={currentPage === 1 || loading}
                type='button'
              >
                ‹ Prev
              </button>
              <div className={s.pageNumbers}>
                {getPageNumbers().map((page, idx) =>
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className={s.ellipsis}>
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      className={clsx(s.pageNumber, {
                        [s.activePage]: currentPage === page,
                      })}
                      onClick={() => handlePageClick(page)}
                      disabled={loading}
                      type='button'
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>
              <button
                className={s.pageBtn}
                onClick={handleNextPage}
                disabled={currentPage >= pagination.pages || loading}
                type='button'
              >
                Next ›
              </button>
            </>
          )}
        </div>
      )}

      {/* Group Roles Modal */}
      <GroupRolesModal ref={rolesModalRef} />

      {/* Group Permissions Modal */}
      <GroupPermissionsModal ref={permissionsModalRef} />

      {/* Delete Confirmation Modal */}
      <DeleteGroupModal ref={deleteModalRef} onSuccess={refreshGroups} />
    </div>
  );
}

export default Groups;
