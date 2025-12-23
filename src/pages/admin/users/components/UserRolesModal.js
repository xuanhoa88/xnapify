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
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import { Modal } from '../../../../components/Modal';
import { Icon } from '../../../../components/Admin';
import { fetchRoles, assignRolesToUser, fetchUsers } from '../../../../redux';
import s from './UserRolesModal.css';

/**
 * UserRolesModal - Self-contained modal for managing user roles
 *
 * Usage:
 *   const rolesModalRef = useRef();
 *   rolesModalRef.current.open(user);           // Open for single user
 *   rolesModalRef.current.openBulk(userIds);    // Open for bulk assignment
 *   rolesModalRef.current.close();              // Close modal
 *
 * Features:
 *   - Independent data fetching (not dependent on shared Redux state)
 *   - Search functionality with debouncing
 *   - Pagination with page navigation
 */
const ITEMS_PER_PAGE = 10;

const UserRolesModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();

  // Local roles state - fetched independently when modal opens
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceTimer = useRef(null);

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load roles function
  const loadRoles = useCallback(
    async (page = 1, search = '') => {
      setRolesLoading(true);
      try {
        const result = await dispatch(
          fetchRoles({ page, limit: ITEMS_PER_PAGE, search }),
        );
        if (result.success && result.data) {
          const { roles, pagination } = result.data;
          if (Array.isArray(roles)) {
            setRoles(roles);
          }
          if (pagination) {
            setCurrentPage(pagination.page || page);
            setTotalPages(pagination.pages || 1);
            setTotalItems(pagination.total || 0);
          }
        }
      } catch (err) {
        setError('Failed to load roles');
      } finally {
        setRolesLoading(false);
      }
    },
    [dispatch],
  );

  // Fetch roles when modal opens or search/page changes
  useEffect(() => {
    if (isOpen) {
      loadRoles(currentPage, searchTerm);
    }
  }, [isOpen, currentPage, searchTerm, loadRoles]);

  // Handle search input with debounce
  const handleSearchChange = useCallback(e => {
    const { value } = e.target;
    setSearchInput(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setSearchTerm(value);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSearchInput('');
    setSearchTerm('');
    setCurrentPage(1);
  }, []);

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

  // Initialize selections from user roles
  const initSelections = useCallback(targetUser => {
    if (targetUser) {
      const userRoles = Array.isArray(targetUser.roles)
        ? [...new Set(targetUser.roles)]
        : [];
      setSelections(userRoles);
    } else {
      setSelections([]);
    }
  }, []);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setUser(null);
    setIsBulk(false);
    setBulkUserIds([]);
    setSelections([]);
    setRoles([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
    setSearchInput('');
    setSearchTerm('');
    setError(null);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetUser => {
        setUser(targetUser);
        setIsBulk(false);
        setBulkUserIds([]);
        initSelections(targetUser);
        setError(null);
        setSearchInput('');
        setSearchTerm('');
        setCurrentPage(1);
        setIsOpen(true);
      },
      openBulk: userIds => {
        setUser(null);
        setIsBulk(true);
        setBulkUserIds(userIds);
        setSelections([]);
        setError(null);
        setSearchInput('');
        setSearchTerm('');
        setCurrentPage(1);
        setIsOpen(true);
      },
      close: resetState,
    }),
    [initSelections, resetState],
  );

  const toggleSelection = useCallback(role => {
    setSelections(prev =>
      prev.includes(role) ? prev.filter(x => x !== role) : [...prev, role],
    );
  }, []);

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetUsers = isBulk ? bulkUserIds : [user.id];
      for (const userId of targetUsers) {
        const result = await dispatch(assignRolesToUser(userId, selections));
        if (!result.success) {
          setError(result.error || 'Failed to assign roles');
          setLoading(false);
          return;
        }
      }
      // Refresh users list
      dispatch(fetchUsers({ page: 1 }));
      handleClose();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [dispatch, isBulk, bulkUserIds, user, selections, handleClose]);

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

  const description = isBulk
    ? 'Select roles to assign to the selected users.'
    : "Select roles to assign to this user. The user's permissions will be based on these roles.";

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        {isBulk
          ? `Assign Roles to ${bulkUserIds.length} Users`
          : `Manage Roles for "${user && (user.display_name || user.email)}"`}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>{description}</Modal.Description>

        {/* Search Input */}
        <div className={s.searchWrapper}>
          <span className={s.searchIcon}>
            <Icon name='search' size={16} />
          </span>
          <input
            type='text'
            className={s.searchInput}
            placeholder='Search roles...'
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button
              className={s.searchClear}
              onClick={handleClearSearch}
              type='button'
            >
              <Icon name='close' size={10} />
            </button>
          )}
        </div>

        <div className={s.checkboxList}>
          {rolesLoading ? (
            <div className={s.noItems}>Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className={s.noItems}>
              {searchTerm ? 'No roles match your search' : 'No roles available'}
            </div>
          ) : (
            roles.map(role => (
              <div
                key={role.id}
                className={clsx(s.checkboxListItem, {
                  [s.selected]: selections.includes(role.name),
                })}
                onClick={() => toggleSelection(role.name)}
                role='checkbox'
                aria-checked={selections.includes(role.name)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleSelection(role.name);
                  }
                }}
              >
                <input
                  type='checkbox'
                  className={s.checkbox}
                  checked={selections.includes(role.name)}
                  onChange={() => {}}
                  tabIndex={-1}
                />
                <div className={s.checkboxContent}>
                  <span className={s.checkboxListLabel}>{role.name}</span>
                  {role.description && (
                    <span className={s.checkboxListDesc}>
                      {role.description}
                    </span>
                  )}
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
                  disabled={currentPage === 1 || rolesLoading}
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
                        disabled={rolesLoading}
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
                  disabled={currentPage >= totalPages || rolesLoading}
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
        <Modal.SelectionCount
          count={selections.length}
          singular='role'
          plural='roles'
        />
        <Modal.Actions>
          <Modal.Button onClick={handleClose}>Cancel</Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

UserRolesModal.displayName = 'UserRolesModal';

export default UserRolesModal;
