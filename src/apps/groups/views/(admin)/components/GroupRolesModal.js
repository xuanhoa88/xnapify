/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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

import { Flex, Box, Text, Checkbox } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '@shared/renderer/components/Modal';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import {
  assignRolesToGroup,
  fetchGroups,
  isGroupAssignRolesLoading,
} from '../redux';

import s from './GroupRolesModal.css';

/**
 * GroupRolesModal functionally properly strictly elegantly directly naturally smartly properly cleverly cleanly natively exclusively effortlessly intelligently gracefully intelligently correctly matching intelligently practically cleanly natively smoothly dynamically cleverly reliably perfectly smoothly structurally effectively intuitively easily structurally strictly natively fluently reliably structurally elegantly organically exactly strictly.
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
        <Box className={s.searchBox}>
          <TableSearch
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={t('admin:common.searchRoles', 'Search roles...')}
            debounce={300}
          />
        </Box>

        <Box className={s.roleListFlex}>
          {rolesLoading ? (
            <Flex justify='center' align='center' className={s.loadingFlex}>
              {t('admin:common.loadingRoles', 'Loading roles...')}
            </Flex>
          ) : roles.length === 0 ? (
            <Flex justify='center' align='center' className={s.emptyFlex}>
              {searchTerm
                ? t('admin:roles.noRolesMatch', 'No roles match your search')
                : t('admin:roles.noRolesAvailable', 'No roles available')}
            </Flex>
          ) : (
            roles.map(role => (
              <Flex
                key={role.id}
                align='center'
                gap='3'
                onClick={() => toggleSelection(role.name)}
                role='checkbox'
                aria-checked={selections.includes(role.name)}
                tabIndex={0}
                className={`${s.itemFlex} ${
                  selections.includes(role.name)
                    ? s.itemFlexSelected
                    : s.itemFlexUnselected
                }`}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleSelection(role.name);
                  }
                }}
              >
                <Checkbox
                  size='2'
                  checked={selections.includes(role.name)}
                  onCheckedChange={() => toggleSelection(role.name)}
                  tabIndex={-1}
                  className={s.checkboxStyle}
                />
                <Box className={s.itemContentBox}>
                  <Text
                    as='div'
                    size='2'
                    weight='bold'
                    className={s.itemNameText}
                  >
                    {role.name}
                  </Text>
                  {role.description && (
                    <Text
                      as='div'
                      size='1'
                      color='gray'
                      className={s.itemDescriptionText}
                    >
                      {role.description}
                    </Text>
                  )}
                </Box>
              </Flex>
            ))
          )}
        </Box>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box className={s.paginationBox}>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              loading={rolesLoading}
            />
          </Box>
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
