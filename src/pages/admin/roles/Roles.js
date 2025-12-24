/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../components/History';
import { fetchRoles, getRolesPagination, deleteRole } from '../../../redux';
import {
  Page,
  Icon,
  Loader,
  Table,
  ConfirmModal,
} from '../../../components/Admin';
import RoleActionsDropdown from './components/RoleActionsDropdown';
import RolePermissionsModal from './components/RolePermissionsModal';
import RoleUsersModal from './components/RoleUsersModal';
import RoleGroupsModal from './components/RoleGroupsModal';
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

  const handleDeleteRole = useCallback(
    item => dispatch(deleteRole(item.id)),
    [dispatch],
  );

  const getRoleName = useCallback(item => item.name, []);

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

  if (loading && roles.length === 0) {
    return (
      <div className={s.root}>
        <Page.Header
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
        <Page.Header
          icon={<Icon name='shield' size={24} />}
          title={t('roles.title', 'Role Management')}
          subtitle='Define access levels and permissions'
        />
        <Table.Error
          title={t('roles.errorLoading', 'Error loading roles')}
          error={error}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() =>
            dispatch(
              fetchRoles({
                page: currentPage,
                limit: ITEMS_PER_PAGE,
                search,
              }),
            )
          }
        />
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Page.Header
        icon={<Icon name='shield' size={24} />}
        title={t('roles.title', 'Role Management')}
        subtitle='Define access levels and permissions'
      >
        <button type='button' className={s.addButton} onClick={handleAddRole}>
          <Icon name='plus' size={16} />
          {t('roles.addRole', 'Add Role')}
        </button>
      </Page.Header>

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
        <Table.Empty
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
      {pagination && pagination.pages > 1 && (
        <Table.Pagination
          currentPage={currentPage}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setCurrentPage}
          loading={loading}
        />
      )}

      {/* Permissions Modal */}
      <RolePermissionsModal ref={permissionsModalRef} />

      {/* Users Modal */}
      <RoleUsersModal ref={usersModalRef} />

      {/* Groups Modal */}
      <RoleGroupsModal ref={groupsModalRef} />

      {/* Delete Confirmation Modal */}
      <ConfirmModal.Delete
        ref={deleteModalRef}
        title='Delete Role'
        getItemName={getRoleName}
        onDelete={handleDeleteRole}
        onSuccess={refreshRoles}
      />
    </div>
  );
}

export default Roles;
