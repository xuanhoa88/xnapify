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
import { fetchRoles, assignRolesToGroup, fetchGroups } from '../../../../redux';
import s from './Modal.css';

/**
 * GroupRolesModal - Self-contained modal for managing group roles
 *
 * Usage:
 *   const rolesModalRef = useRef();
 *   rolesModalRef.current.open(group);    // Open for a group
 *   rolesModalRef.current.close();        // Close modal
 *
 * Features:
 *   - Independent data fetching (not dependent on shared Redux state)
 *   - Search functionality with debouncing
 *   - Pagination with page navigation
 */
const ITEMS_PER_PAGE = 10;

const GroupRolesModal = forwardRef((props, ref) => {
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
  const [group, setGroup] = useState(null);
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
          const { roles: fetchedRoles, pagination } = result.data;
          if (Array.isArray(fetchedRoles)) {
            setRoles(fetchedRoles);
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

  // Initialize selections from group roles
  const initSelections = useCallback(targetGroup => {
    if (targetGroup && targetGroup.roles) {
      const groupRoles = Array.isArray(targetGroup.roles)
        ? targetGroup.roles.map(r => r.name || r)
        : [];
      setSelections([...new Set(groupRoles)]);
    } else {
      setSelections([]);
    }
  }, []);

  // Reset state helper
  const resetState = useCallback(() => {
    setIsOpen(false);
    setGroup(null);
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
      open: targetGroup => {
        setGroup(targetGroup);
        initSelections(targetGroup);
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
      const result = await dispatch(assignRolesToGroup(group.id, selections));
      if (result.success) {
        // Refresh groups list
        dispatch(fetchGroups({ page: 1 }));
        handleClose();
      } else {
        setError(result.error || 'Failed to assign roles');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [dispatch, group, selections, handleClose]);

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

  const title = `Manage Roles for "${(group && group.name) || 'Group'}"`;

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
          <p className={s.modalDescription}>
            Select roles to assign to this group. All members of the group will
            inherit these roles.
          </p>

          {/* Search Input */}
          <div className={s.searchWrapper}>
            <span className={s.searchIcon}>🔍</span>
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
                ×
              </button>
            )}
          </div>

          <div className={s.checkboxList}>
            {rolesLoading ? (
              <div className={s.noItems}>Loading roles...</div>
            ) : roles.length === 0 ? (
              <div className={s.noItems}>
                {searchTerm
                  ? 'No roles match your search'
                  : 'No roles available'}
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
        </div>
        <div className={s.modalFooter}>
          <span className={s.selectionCount}>
            {selections.length} role{selections.length !== 1 ? 's' : ''}{' '}
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

GroupRolesModal.displayName = 'GroupRolesModal';

export default GroupRolesModal;
