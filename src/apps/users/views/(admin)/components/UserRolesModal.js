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
} from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Modal from '@shared/renderer/components/Modal';
import Table from '@shared/renderer/components/Table';
import { assignRolesToUser, isUserAssignRolesLoading } from '../redux';
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

const UserRolesModal = forwardRef(({ onSuccess, fetchRoles }, ref) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const loading = useSelector(isUserAssignRolesLoading);

  // Local roles state - fetched independently when modal opens
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Internal state
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [selections, setSelections] = useState([]);
  const [error, setError] = useState(null);

  // Load roles function
  const loadRoles = useCallback(
    async (page = 1, search = '') => {
      setRolesLoading(true);
      try {
        const data = await dispatch(
          fetchRoles({ page, limit: ITEMS_PER_PAGE, search }),
        ).unwrap();
        const { roles, pagination } = data;
        if (Array.isArray(roles)) {
          setRoles(roles);
        }
        if (pagination) {
          setCurrentPage(pagination.page || page);
          setTotalPages(pagination.pages || 1);
          setTotalItems(pagination.total || 0);
        }
      } catch (err) {
        setError(
          err || t('admin:users.errors.loadRoles', 'Failed to load roles'),
        );
      } finally {
        setRolesLoading(false);
      }
    },
    [dispatch, t, fetchRoles],
  );

  // Fetch roles when modal opens or search/page changes
  useEffect(() => {
    if (isOpen) {
      loadRoles(currentPage, searchTerm);
    }
  }, [isOpen, currentPage, searchTerm, loadRoles]);

  // Handle search change
  const handleSearchChange = useCallback(value => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
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
    setSearchTerm('');
    setError(null);
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
    setError(null);
    try {
      const targetUsers = isBulk ? bulkUserIds : [user.id];
      for (const userId of targetUsers) {
        await dispatch(
          assignRolesToUser({ userId, roleNames: selections }),
        ).unwrap();
      }
      // Call success callback
      onSuccess && onSuccess();
      handleClose();
    } catch (err) {
      setError(
        err || t('admin:users.errors.assignRoles', 'Failed to assign roles'),
      );
    }
  }, [
    dispatch,
    isBulk,
    bulkUserIds,
    user,
    selections,
    handleClose,
    onSuccess,
    t,
  ]);

  const description = isBulk
    ? t(
        'admin:users.roles.assignRolesBulkDesc',
        'Select roles to assign to the selected users.',
      )
    : t(
        'admin:users.roles.assignRolesDesc',
        "Select roles to assign to this user. The user's permissions will be based on these roles.",
      );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} placement='right'>
      <Modal.Header onClose={handleClose}>
        {isBulk
          ? t(
              'admin:users.roles.assignRolesBulk',
              'Assign Roles to {{count}} Users',
              { count: bulkUserIds.length },
            )
          : t('admin:users.roles.manageRoles', 'Manage Roles for "{{name}}"', {
              name:
                user &&
                ((user.profile && user.profile.display_name) || user.email),
            })}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>{description}</Modal.Description>

        {/* Search Input */}
        <Table.SearchBar
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder={t('admin:users.roles.searchRoles', 'Search roles...')}
          debounce={300}
          className={s.modalSearchBar}
        />

        <div className={s.checkboxList}>
          {rolesLoading ? (
            <div className={s.noItems}>
              {t('admin:users.roles.loadingRoles', 'Loading roles...')}
            </div>
          ) : roles.length === 0 ? (
            <div className={s.noItems}>
              {searchTerm
                ? t(
                    'admin:users.roles.noRolesMatch',
                    'No roles match your search',
                  )
                : t('admin:users.roles.noRolesAvailable', 'No roles available')}
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
        <Modal.SelectionCount count={selections.length} />
        <Modal.Actions>
          <Modal.Button onClick={handleClose}>
            {t('admin:users.roles.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? t('admin:users.roles.saving', 'Saving...')
              : t('admin:users.roles.save', 'Save')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

UserRolesModal.displayName = 'UserRolesModal';

UserRolesModal.propTypes = {
  onSuccess: PropTypes.func,
  fetchRoles: PropTypes.func.isRequired,
};

export default UserRolesModal;
