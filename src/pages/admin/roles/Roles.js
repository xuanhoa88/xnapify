/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useHistory } from '../../../components/History';
import { fetchRoles, getRolesPagination } from '../../../redux';
import RoleActionsDropdown from './components/RoleActionsDropdown';
import RolePermissionsModal from './components/RolePermissionsModal';
import RoleUsersModal from './components/RoleUsersModal';
import RoleGroupsModal from './components/RoleGroupsModal';
import DeleteRoleModal from './components/DeleteRoleModal';
import { PageHeader, Icon, Loader, Empty } from '../../../components/Admin';
import s from './Roles.css';

// Pagination items per page
const ITEMS_PER_PAGE = 10;

// Map role names to icon names for visual consistency
const ROLE_ICONS = Object.freeze({
  admin: 'crown',
  mod: 'shield',
  user: 'user',
  guest: 'eye',
  editor: 'edit',
  viewer: 'eye',
});

const getRoleIcon = roleName => {
  const iconName = ROLE_ICONS[roleName.toLowerCase()] || 'clipboard';
  return <Icon name={iconName} size={24} />;
};

function Roles() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const { roles, loading, error } = useSelector(state => state.admin.roles);
  const pagination = useSelector(getRolesPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const debounceTimer = useRef(null);

  // Delete modal ref
  const deleteModalRef = useRef();

  // Permissions modal ref
  const permissionsModalRef = useRef();

  // Users modal ref
  const usersModalRef = useRef();

  // Groups modal ref
  const groupsModalRef = useRef();

  // Dropdown state
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  useEffect(() => {
    dispatch(fetchRoles({ page: currentPage, limit: ITEMS_PER_PAGE, search }));
  }, [dispatch, currentPage, search]);

  // Refresh roles list callback
  const refreshRoles = useCallback(() => {
    dispatch(fetchRoles({ page: currentPage, limit: ITEMS_PER_PAGE, search }));
  }, [dispatch, currentPage, search]);

  const handleAddRole = useCallback(() => {
    history.push('/admin/roles/create');
  }, [history]);

  const handleEditRole = useCallback(
    role => {
      history.push(`/admin/roles/${role.id}/edit`);
    },
    [history],
  );

  // Dropdown action handlers
  const handleViewUsers = useCallback(role => {
    usersModalRef.current && usersModalRef.current.open(role);
  }, []);

  const handleViewGroups = useCallback(role => {
    groupsModalRef.current && groupsModalRef.current.open(role);
  }, []);

  const handleViewPermissions = useCallback(role => {
    permissionsModalRef.current && permissionsModalRef.current.open(role);
  }, []);

  const handleToggleDropdown = useCallback(id => {
    setActiveDropdownId(prev => (prev === id ? null : id));
  }, []);

  // Open delete confirmation modal
  const handleDeleteClick = useCallback(role => {
    deleteModalRef.current && deleteModalRef.current.open(role);
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

  const handleClearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setInputValue('');
    setSearch('');
    setCurrentPage(1);
  }, []);

  const handleSearchKeyDown = useCallback(
    e => {
      if (e.key === 'Enter') {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        setSearch(inputValue);
        setCurrentPage(1);
      }
    },
    [inputValue],
  );

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

  // Generate page numbers for pagination (memoized)
  const pageNumbers = useMemo(() => {
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

  if (loading && roles.length === 0) {
    return (
      <div className={s.root}>
        <PageHeader
          icon={<Icon name='shield' size={24} />}
          title={t('roles.title', 'Role Management')}
          subtitle='Define access levels and permissions'
        />
        <Loader
          variant='cards'
          message={t('roles.loading', 'Loading roles...')}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <PageHeader
          icon={<Icon name='shield' size={24} />}
          title={t('roles.title', 'Role Management')}
          subtitle='Define access levels and permissions'
        />
        <div className={s.error}>
          <p>
            {t('roles.errorLoading', 'Error loading roles')}: {error}
          </p>
          <button
            type='button'
            className={s.addButton}
            onClick={() =>
              dispatch(
                fetchRoles({
                  page: currentPage,
                  limit: ITEMS_PER_PAGE,
                  search,
                }),
              )
            }
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <PageHeader
        icon={<Icon name='shield' size={24} />}
        title={t('roles.title', 'Role Management')}
        subtitle='Define access levels and permissions'
      >
        <button type='button' className={s.addButton} onClick={handleAddRole}>
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
          {t('roles.addRole', 'Add Role')}
        </button>
      </PageHeader>

      {/* Search/Filter Section */}
      <div className={s.filters}>
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            placeholder={t('roles.searchPlaceholder', 'Search roles...')}
            className={s.searchInput}
            value={inputValue}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          {inputValue && (
            <button
              className={s.searchClear}
              onClick={handleClearSearch}
              type='button'
              title={t('common.clearSearch', 'Clear search')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {roles.length === 0 ? (
        <Empty
          icon='shield'
          title={t('roles.noRolesFound', 'No roles found')}
          description={t(
            'roles.noRolesDescription',
            'Create a new role to define access levels and permissions.',
          )}
          actionLabel={t('roles.addRole', 'Add Role')}
          onAction={handleAddRole}
        />
      ) : (
        <div className={s.grid}>
          {roles.map(role => (
            <div key={role.id} className={s.roleCard}>
              <div className={s.roleHeader}>
                <div className={s.roleIcon}>{getRoleIcon(role.name)}</div>
                <h3 className={s.roleName}>{role.name}</h3>
                <RoleActionsDropdown
                  role={role}
                  isOpen={activeDropdownId === role.id}
                  onToggle={handleToggleDropdown}
                  onViewUsers={handleViewUsers}
                  onViewGroups={handleViewGroups}
                  onViewPermissions={handleViewPermissions}
                  onEdit={handleEditRole}
                  onDelete={handleDeleteClick}
                />
              </div>
              <p className={s.roleDescription}>
                {role.description ||
                  t('roles.noDescription', 'No description available')}
              </p>
              <div className={s.roleStats}>
                <div className={s.stat}>
                  <span className={s.statLabel}>
                    {t('roles.users', 'Users')}:
                  </span>
                  <span className={s.statValue}>{role.usersCount || 0}</span>
                </div>
                <div className={s.stat}>
                  <span className={s.statLabel}>
                    {t('roles.groups', 'Groups')}:
                  </span>
                  <span className={s.statValue}>{role.groupsCount || 0}</span>
                </div>
                <div className={s.stat}>
                  <span className={s.statLabel}>
                    {t('roles.permissions', 'Permissions')}:
                  </span>
                  <span className={s.statValue}>
                    {role.permissionsCount || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && (pagination.pages > 1 || pagination.total > 0) && (
        <div className={s.pagination}>
          <span className={s.paginationInfo}>
            {pagination.total} {t('common.total', 'total')} ·{' '}
            {t('common.page', 'Page')} {currentPage} {t('common.of', 'of')}{' '}
            {pagination.pages}
          </span>
          {pagination.pages > 1 && (
            <>
              <button
                className={s.pageBtn}
                onClick={handlePrevPage}
                disabled={currentPage === 1 || loading}
                type='button'
              >
                ‹ {t('common.prev', 'Prev')}
              </button>
              <div className={s.pageNumbers}>
                {pageNumbers.map((page, idx) =>
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
                {t('common.next', 'Next')} ›
              </button>
            </>
          )}
        </div>
      )}

      {/* Permissions Modal */}
      <RolePermissionsModal ref={permissionsModalRef} />

      {/* Users Modal */}
      <RoleUsersModal ref={usersModalRef} />

      {/* Groups Modal */}
      <RoleGroupsModal ref={groupsModalRef} />

      {/* Delete Confirmation Modal */}
      <DeleteRoleModal ref={deleteModalRef} onSuccess={refreshRoles} />
    </div>
  );
}

export default Roles;
