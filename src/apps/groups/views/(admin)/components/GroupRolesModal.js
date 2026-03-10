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
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import Modal from '../../../../../shared/renderer/components/Modal';
import Table from '../../../../../shared/renderer/components/Table';
import {
  assignRolesToGroup,
  fetchGroups,
  isGroupAssignRolesLoading,
} from '../redux';
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

const GroupRolesModal = forwardRef(({ fetchRoles }, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const loading = useSelector(isGroupAssignRolesLoading);

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
  const [group, setGroup] = useState(null);
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
        const { roles: fetchedRoles, pagination } = data;
        if (Array.isArray(fetchedRoles)) {
          setRoles(fetchedRoles);
        }
        if (pagination) {
          setCurrentPage(pagination.page || page);
          setTotalPages(pagination.pages || 1);
          setTotalItems(pagination.total || 0);
        }
      } catch (err) {
        setError(err || t('admin:errors.loadRoles', 'Failed to load roles'));
      } finally {
        setRolesLoading(false);
      }
    },
    [dispatch, fetchRoles, t],
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
    setSearchTerm('');
    setError(null);
  }, []);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      open: targetGroup => {
        setGroup(targetGroup);
        initSelections(targetGroup);
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
      await dispatch(
        assignRolesToGroup({ groupId: group.id, roleNames: selections }),
      ).unwrap();
      // Refresh groups list
      dispatch(fetchGroups({ page: 1 }));
      handleClose();
    } catch (err) {
      setError(err || t('admin:errors.assignRoles', 'An error occurred'));
    }
  }, [dispatch, group, selections, handleClose, t]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} placement='right'>
      <Modal.Header onClose={handleClose}>
        {t('admin:groups.manageRolesFor', 'Manage Roles for "{{groupName}}"', {
          groupName:
            (group && group.name) || t('admin:common.unknown', 'Unknown'),
        })}
      </Modal.Header>
      <Modal.Body error={error}>
        <Modal.Description>
          {t(
            'admin:groups.manageRolesDescription',
            'Select roles to assign to this group. All users of the group will inherit these roles.',
          )}
        </Modal.Description>

        {/* Search Input */}
        <Table.SearchBar
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder={t('admin:common.searchRoles', 'Search roles...')}
          debounce={300}
          className={s.modalSearchBar}
        />

        <div className={s.checkboxList}>
          {rolesLoading ? (
            <div className={s.noItems}>
              {t('admin:common.loadingRoles', 'Loading roles...')}
            </div>
          ) : roles.length === 0 ? (
            <div className={s.noItems}>
              {searchTerm
                ? t('admin:roles.noRolesMatch', 'No roles match your search')
                : t('admin:roles.noRolesAvailable', 'No roles available')}
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
            {t('admin:common.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button
            variant='primary'
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? t('admin:common.saving', 'Saving...')
              : t('admin:common.save', 'Save')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </Modal>
  );
});

GroupRolesModal.displayName = 'GroupRolesModal';

GroupRolesModal.propTypes = {
  fetchRoles: PropTypes.func.isRequired,
};

export default GroupRolesModal;
