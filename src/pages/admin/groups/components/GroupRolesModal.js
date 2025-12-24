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
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import { Modal } from '../../../../components/Modal';
import { Icon, Table } from '../../../../components/Admin';
import { fetchRoles, assignRolesToGroup, fetchGroups } from '../../../../redux';
import s from './GroupRolesModal.css';

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
  const { t } = useTranslation();
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        Manage Roles for &quot;
        {(group && group.name) || t('common.unknown', 'Unknown')}&quot;
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          Select roles to assign to this group. All users of the group will
          inherit these roles.
        </Modal.Description>

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
        {totalPages > 1 && (
          <Table.Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            loading={rolesLoading}
          />
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

GroupRolesModal.displayName = 'GroupRolesModal';

export default GroupRolesModal;
