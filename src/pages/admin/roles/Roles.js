/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { useHistory } from '../../../contexts/history';
import { fetchRoles, deleteRole, getRolesPagination } from '../../../redux';
import s from './Roles.css';

// Map role names to icons for visual consistency
const ROLE_ICONS = Object.freeze({
  admin: '👑',
  moderator: '🎭',
  user: '👤',
  guest: '👁️',
  editor: '✏️',
  viewer: '👀',
});

// Pagination items per page
const ITEMS_PER_PAGE = 10;

const getRoleIcon = roleName => {
  return ROLE_ICONS[roleName.toLowerCase()] || '📋';
};

function Roles() {
  const dispatch = useDispatch();
  const history = useHistory();
  const { roles, loading, error } = useSelector(state => state.admin.roles);
  const pagination = useSelector(getRolesPagination);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(fetchRoles({ page: currentPage, limit: ITEMS_PER_PAGE }));
  }, [dispatch, currentPage]);

  const handleAddRole = useCallback(() => {
    history.push('/admin/roles/create');
  }, [history]);

  const handleEditRole = useCallback(
    roleId => {
      history.push(`/admin/roles/${roleId}/edit`);
    },
    [history],
  );

  const handleDelete = useCallback(
    async (roleId, roleName) => {
      if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
        return;
      }

      const result = await dispatch(deleteRole(roleId));
      if (!result.success) {
        alert(`Failed to delete role: ${result.error}`);
      } else {
        // Refresh the list
        dispatch(fetchRoles({ page: currentPage, limit: ITEMS_PER_PAGE }));
      }
    },
    [dispatch, currentPage],
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

  if (loading && roles.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Role Management</h1>
        </div>
        <div className={s.loading}>Loading roles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>Role Management</h1>
        </div>
        <div className={s.error}>
          <p>Error loading roles: {error}</p>
          <button
            className={s.addButton}
            onClick={() =>
              dispatch(fetchRoles({ page: currentPage, limit: ITEMS_PER_PAGE }))
            }
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Role Management</h1>
        <button className={s.addButton} onClick={handleAddRole}>
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
          Add Role
        </button>
      </div>

      {roles.length === 0 ? (
        <div className={s.empty}>
          <p>No roles found.</p>
        </div>
      ) : (
        <div className={s.grid}>
          {roles.map(role => (
            <div key={role.id} className={s.roleCard}>
              <div className={s.roleHeader}>
                <div className={s.roleIcon}>{getRoleIcon(role.name)}</div>
                <h3 className={s.roleName}>{role.name}</h3>
              </div>
              <p className={s.roleDescription}>
                {role.description || 'No description available'}
              </p>
              <div className={s.roleStats}>
                <div className={s.stat}>
                  <span className={s.statLabel}>Users:</span>
                  <span className={s.statValue}>{role.usersCount || 0}</span>
                </div>
                <div className={s.stat}>
                  <span className={s.statLabel}>Permissions:</span>
                  <span className={s.statValue}>
                    {role.permissionsCount || 0}
                  </span>
                </div>
              </div>
              <div className={s.roleActions}>
                <button
                  className={s.editBtn}
                  onClick={() => handleEditRole(role.id)}
                >
                  Edit
                </button>
                <button
                  className={s.deleteBtn}
                  onClick={() => handleDelete(role.id, role.name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
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
    </div>
  );
}

export default Roles;
