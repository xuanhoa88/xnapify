/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useHistory } from '../../../../components/History';
import { fetchRoleUsers } from '../../../../redux';
import s from './RoleUsers.css';

const ITEMS_PER_PAGE = 10;

function RoleUsers({ roleId }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const loadUsers = useCallback(
    async page => {
      setLoading(true);
      const result = await dispatch(
        fetchRoleUsers(roleId, { page, limit: ITEMS_PER_PAGE }),
      );
      if (result.success) {
        const usersData = result.data.users || result.data.rows || [];
        setUsers(usersData);
        setRole(result.data.role);
        setPagination(result.data.pagination);
      } else {
        setError(result.error);
      }
      setLoading(false);
    },
    [dispatch, roleId],
  );

  useEffect(() => {
    if (roleId) {
      loadUsers(currentPage);
    }
  }, [loadUsers, currentPage, roleId]);

  const handleBack = useCallback(() => {
    history.push('/admin/roles');
  }, [history]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (pagination && currentPage < pagination.pages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, pagination]);

  const handlePageClick = useCallback(page => {
    setCurrentPage(page);
  }, []);

  // Generate page numbers with ellipsis
  const getPageNumbers = useCallback(() => {
    if (!pagination || pagination.pages <= 1) return [];
    const pages = [];
    const totalPages = pagination.pages;
    const current = currentPage;

    // Always show first page
    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    // Show pages around current
    for (
      let i = Math.max(2, current - 1);
      i <= Math.min(totalPages - 1, current + 1);
      i++
    ) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (current < totalPages - 2) {
      pages.push('...');
    }

    // Always show last page
    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  }, [pagination, currentPage]);

  if (loading && users.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>{t('roles.users', 'Role Users')}</h1>
          <button type='button' className={s.backBtn} onClick={handleBack}>
            ← {t('roles.backToRoles', 'Back to Roles')}
          </button>
        </div>
        <div className={s.loading}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <h1 className={s.title}>{t('roles.users', 'Role Users')}</h1>
          <button type='button' className={s.backBtn} onClick={handleBack}>
            ← {t('roles.backToRoles', 'Back to Roles')}
          </button>
        </div>
        <div className={s.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>
          {t('roles.usersWithRole', 'Manage Users for role')}
          &quot;{(role && role.name) || t('common.unknown', 'Unknown')}&quot;
        </h1>
        <button type='button' className={s.backBtn} onClick={handleBack}>
          ← {t('roles.backToRoles', 'Back to Roles')}
        </button>
      </div>

      <div className={s.content}>
        <div className={s.tableContainer}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('common.name', 'Name')}</th>
                <th>{t('common.email', 'Email')}</th>
                <th>{t('common.status', 'Status')}</th>
                <th>{t('common.joinedDate', 'Joined Date')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan='4' className={s.empty}>
                    {t('roles.noUsersWithRole', 'No users have this role')}
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td>
                      {(user.profile && user.profile.display_name) ||
                        user.display_name ||
                        'N/A'}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span
                        className={`${s.status} ${
                          user.is_active ? s.statusActive : s.statusInactive
                        }`}
                      >
                        {user.is_active
                          ? t('common.active', 'Active')
                          : t('common.inactive', 'Inactive')}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className={s.pagination}>
          <span className={s.paginationInfo}>
            {pagination.total} {t('common.total', 'total')} ·{' '}
            {t('common.page', 'Page')} {currentPage} {t('common.of', 'of')}{' '}
            {pagination.pages}
          </span>
          <button
            type='button'
            className={s.pageBtn}
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            ← {t('common.prev', 'Prev')}
          </button>
          <div className={s.pageNumbers}>
            {getPageNumbers().map((page, index) =>
              page === '...' ? (
                <span key={`ellipsis-${index}`} className={s.ellipsis}>
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  type='button'
                  onClick={() => handlePageClick(page)}
                  className={clsx(s.pageNumber, {
                    [s.activePage]: page === currentPage,
                  })}
                >
                  {page}
                </button>
              ),
            )}
          </div>
          <button
            type='button'
            className={s.pageBtn}
            onClick={handleNextPage}
            disabled={!pagination || currentPage >= pagination.pages}
          >
            {t('common.next', 'Next')} →
          </button>
        </div>
      )}
    </div>
  );
}

RoleUsers.propTypes = {
  roleId: PropTypes.string.isRequired,
};

export default RoleUsers;
