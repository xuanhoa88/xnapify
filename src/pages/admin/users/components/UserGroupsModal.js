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
} from 'react';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import { assignGroupsToUser, fetchUsers, fetchGroups } from '../../../../redux';
import s from './Modal.css';

/**
 * UserGroupsModal - Self-contained modal for managing user groups
 *
 * Usage:
 *   const groupsModalRef = useRef();
 *   groupsModalRef.current.open(user);           // Open for single user
 *   groupsModalRef.current.openBulk(userIds);    // Open for bulk assignment
 *   groupsModalRef.current.close();              // Close modal
 *
 * Features:
 *   - Independent data fetching (not dependent on shared Redux state)
 *   - Search functionality with debouncing
 *   - Pagination with page navigation
 */
const ITEMS_PER_PAGE = 10;

const UserGroupsModal = forwardRef((props, ref) => {
  const dispatch = useDispatch();

  // Local groups state - fetched independently when modal opens
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
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

  // Load groups function
  const loadGroups = useCallback(
    async (page = 1, search = '') => {
      setGroupsLoading(true);
      try {
        const result = await dispatch(
          fetchGroups({ page, limit: ITEMS_PER_PAGE, search }),
        );
        if (result.success && result.data) {
          if (Array.isArray(result.data.groups)) {
            setGroups(result.data.groups);
          }

          const { pagination } = result.data;
          if (pagination) {
            setCurrentPage(pagination.page || page);
            setTotalPages(pagination.pages || 1);
            setTotalItems(pagination.total || 0);
          }
        }
      } catch (err) {
        setError('Failed to load groups');
      } finally {
        setGroupsLoading(false);
      }
    },
    [dispatch],
  );

  // Fetch groups when modal opens or search/page changes
  useEffect(() => {
    if (isOpen) {
      loadGroups(currentPage, searchTerm);
    }
  }, [isOpen, currentPage, searchTerm, loadGroups]);

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

  // Initialize selections from user groups
  const initSelections = useCallback(targetUser => {
    if (targetUser && targetUser.groups) {
      const userGroupIds = targetUser.groups.map(g => g.id);
      setSelections(userGroupIds);
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
    setGroups([]);
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

  const toggleSelection = useCallback(id => {
    setSelections(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
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
        const result = await dispatch(assignGroupsToUser(userId, selections));
        if (!result.success) {
          setError(result.error || 'Failed to assign groups');
          setLoading(false);
          return;
        }
      }
      // Refresh users list
      dispatch(fetchUsers({}));
      handleClose();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [dispatch, isBulk, bulkUserIds, user, selections, handleClose]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
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
  };

  // Don't render if not open
  if (!isOpen) return null;

  const title = isBulk
    ? `Assign Groups to ${bulkUserIds.length} Users`
    : `Manage Groups for "${user && (user.display_name || user.email)}"`;

  const description = isBulk
    ? 'Select groups to assign to the selected users.'
    : 'Select groups for this user. The user will inherit roles from these groups.';

  return (
    <div className={s.modalOverlay} onClick={handleClose} role='presentation'>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={s.modal}
        role='dialog'
        aria-modal='true'
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>{title}</h3>
          <button className={s.modalClose} onClick={handleClose} type='button'>
            ×
          </button>
        </div>
        <div className={s.modalBody}>
          {error && <div className={s.modalError}>{error}</div>}
          <p className={s.modalDescription}>{description}</p>

          {/* Search Input */}
          <div className={s.searchWrapper}>
            <span className={s.searchIcon}>🔍</span>
            <input
              type='text'
              className={s.searchInput}
              placeholder='Search groups...'
              value={searchInput}
              onChange={handleSearchChange}
            />
            {searchInput && (
              <button
                className={s.searchClear}
                onClick={handleClearSearch}
                type='button'
              >
                ×
              </button>
            )}
          </div>

          <div className={s.checkboxList}>
            {groupsLoading ? (
              <div className={s.noItems}>Loading groups...</div>
            ) : groups.length === 0 ? (
              <div className={s.noItems}>
                {searchTerm
                  ? 'No groups match your search'
                  : 'No groups available'}
              </div>
            ) : (
              groups.map(group => (
                <div
                  key={group.id}
                  className={clsx(s.checkboxListItem, {
                    [s.selected]: selections.includes(group.id),
                  })}
                  onClick={() => toggleSelection(group.id)}
                  role='checkbox'
                  aria-checked={selections.includes(group.id)}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleSelection(group.id);
                    }
                  }}
                >
                  <input
                    type='checkbox'
                    className={s.checkbox}
                    checked={selections.includes(group.id)}
                    onChange={() => {}}
                    tabIndex={-1}
                  />
                  <div className={s.checkboxContent}>
                    <span className={s.checkboxListLabel}>{group.name}</span>
                    {group.description && (
                      <span className={s.checkboxListDesc}>
                        {group.description}
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
                    disabled={currentPage === 1 || groupsLoading}
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
                          disabled={groupsLoading}
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
                    disabled={currentPage >= totalPages || groupsLoading}
                    type='button'
                  >
                    Next ›
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className={s.modalFooter}>
          <span className={s.selectionCount}>
            {selections.length} group{selections.length !== 1 ? 's' : ''}{' '}
            selected
          </span>
          <div className={s.modalActions}>
            <button
              className={clsx(s.modalBtn, s.modalBtnSecondary)}
              onClick={handleClose}
              type='button'
            >
              Cancel
            </button>
            <button
              className={clsx(s.modalBtn, s.modalBtnPrimary)}
              onClick={handleSave}
              disabled={loading}
              type='button'
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

UserGroupsModal.displayName = 'UserGroupsModal';

export default UserGroupsModal;
