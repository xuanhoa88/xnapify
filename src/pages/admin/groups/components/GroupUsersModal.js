/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import { Modal } from '../../../../components/Modal';
import { Icon } from '../../../../components/Admin';
import { fetchGroupUsers } from '../../../../redux';
import s from './GroupUsersModal.css';

/**
 * GroupUsersModal - Self-contained modal for viewing group users
 *
 * Usage:
 *   const usersModalRef = useRef();
 *   usersModalRef.current.open(group);    // Open for a group
 *   usersModalRef.current.close();        // Close modal
 *
 * Features:
 *   - Independent data fetching (not dependent on shared Redux state)
 *   - Pagination with page navigation
 */
const ITEMS_PER_PAGE = 10;

// Get user initials
const getInitials = name => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const GroupUsersModal = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Local users state - fetched independently when modal opens
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const debounceTimer = useRef(null);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  // Load users function
  const loadUsers = useCallback(
    async (page = 1) => {
      if (!group) return;
      setUsersLoading(true);
      try {
        const result = await dispatch(
          fetchGroupUsers(group.id, { page, limit: ITEMS_PER_PAGE, search }),
        );
        if (result.success && result.data) {
          const usersData = result.data.users || result.data.rows || [];
          setUsers(usersData);
          if (result.data.pagination) {
            setCurrentPage(result.data.pagination.page || page);
            setTotalPages(result.data.pagination.pages || 1);
            setTotalItems(result.data.pagination.total || 0);
          }
        } else {
          setError(result.error || 'Failed to load users');
        }
      } catch (err) {
        setError('Failed to load users');
      } finally {
        setUsersLoading(false);
      }
    },
    [dispatch, group, search],
  );

  // Fetch users when modal opens or page changes
  useEffect(() => {
    if (isOpen && group) {
      loadUsers(currentPage);
    }
  }, [isOpen, group, currentPage, loadUsers]);

  // Pagination handlers
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  const handlePageClick = useCallback(page => {
    setCurrentPage(page);
  }, []);

  // Search handlers
  const handleSearchChange = useCallback(e => {
    const { value } = e.target;
    setInputValue(value);

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

  // Reset state helper
  const resetState = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setIsOpen(false);
    setGroup(null);
    setUsers([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
    setSearch('');
    setInputValue('');
    setError(null);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetGroup => {
        setGroup(targetGroup);
        setError(null);
        setCurrentPage(1);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [resetState],
  );

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  // Generate page numbers for pagination (memoized)
  const pageNumbers = useMemo(() => {
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
  }, [currentPage, totalPages]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        Users in &quot;
        {(group && group.name) || t('common.unknown', 'Unknown')}&quot;
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          View all users that belong to this group.
        </Modal.Description>

        {/* Search Input */}
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            placeholder={t('common.searchUsers', 'Search users...')}
            className={s.searchInput}
            value={inputValue}
            onChange={handleSearchChange}
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

        <div className={s.usersList}>
          {usersLoading ? (
            <div className={s.noUsers}>Loading users...</div>
          ) : users.length === 0 ? (
            <div className={s.noUsers}>
              {t('groups.noUsersInGroup', 'No users found in this group')}
            </div>
          ) : (
            users.map(user => (
              <div key={user.id} className={s.userItem}>
                <div className={s.userAvatar}>
                  {getInitials(
                    (user.profile && user.profile.display_name) ||
                      user.display_name ||
                      user.email,
                  )}
                </div>
                <div className={s.userInfo}>
                  <span className={s.userName}>
                    {(user.profile && user.profile.display_name) ||
                      user.display_name ||
                      'N/A'}
                  </span>
                  <span className={s.userEmail}>{user.email}</span>
                </div>
                <div className={s.userMeta}>
                  <span
                    className={clsx(s.status, {
                      [s.statusActive]: user.is_active,
                      [s.statusInactive]: !user.is_active,
                    })}
                  >
                    {user.is_active
                      ? t('common.active', 'Active')
                      : t('common.inactive', 'Inactive')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {(totalPages > 1 || totalItems > 0) && (
          <div className={s.pagination}>
            <span className={s.paginationInfo}>
              {totalItems} total · Page {currentPage} of {totalPages}
            </span>
            {totalPages > 1 && (
              <>
                <button
                  className={s.pageBtn}
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || usersLoading}
                  type='button'
                >
                  ‹ Prev
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
                        disabled={usersLoading}
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
                  disabled={currentPage >= totalPages || usersLoading}
                  type='button'
                >
                  Next ›
                </button>
              </>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button onClick={handleClose}>Close</Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

GroupUsersModal.displayName = 'GroupUsersModal';

export default GroupUsersModal;
