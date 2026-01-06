/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../../components/History';
import {
  updateGroup,
  fetchGroupById,
  fetchRoles,
  isGroupUpdateLoading,
  isGroupFetchLoading,
  isGroupFetchInitialized,
  getFetchedGroup,
  getGroupFetchError,
} from '../../../../redux';
import {
  useInfiniteScroll,
  useDebounce,
} from '../../../../components/InfiniteScroll';
import { Box, Icon, Loader, ConfirmModal } from '../../../../components/Admin';
import Button from '../../../../components/Button';
import s from './EditGroup.css';

function EditGroup({ groupId }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isGroupUpdateLoading);
  const fetchingGroup = useSelector(isGroupFetchLoading);
  const fetchInitialized = useSelector(isGroupFetchInitialized);
  const group = useSelector(getFetchedGroup);
  const groupLoadError = useSelector(getGroupFetchError);

  // Roles state for infinite loading
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadingMore, setRolesLoadingMore] = useState(false);
  const [rolesHasMore, setRolesHasMore] = useState(false);
  const [rolesPage, setRolesPage] = useState(1);
  const rolesLimit = 10;
  const rolesContainerRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    type: '',
    roles: [],
  });
  const [roleSearch, setRoleSearch] = useState('');
  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);

  // Fetch roles with pagination
  const loadRoles = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setRolesLoading(true);
      } else {
        setRolesLoadingMore(true);
      }

      try {
        const data = await dispatch(
          fetchRoles({ page, limit: rolesLimit, search }),
        ).unwrap();
        const newRoles = data.roles || [];
        const { pagination } = data;

        if (reset) {
          setRoles(newRoles);
        } else {
          setRoles(prev => [...prev, ...newRoles]);
        }

        setRolesHasMore(pagination && pagination.page < pagination.pages);
        setRolesPage(page);
      } catch (err) {
        // Silently handle error
      } finally {
        setRolesLoading(false);
        setRolesLoadingMore(false);
      }
    },
    [dispatch],
  );

  // Debounced role search using RxJS (also handles initial load on mount)
  useDebounce(roleSearch, 300, debouncedSearch => {
    loadRoles(1, debouncedSearch, true);
  });

  // Load more roles handler
  const handleLoadMoreRoles = useCallback(() => {
    if (!rolesLoadingMore && rolesHasMore) {
      loadRoles(rolesPage + 1, roleSearch, false);
    }
  }, [rolesLoadingMore, rolesHasMore, rolesPage, roleSearch, loadRoles]);

  // RxJS-based infinite scroll for roles
  useInfiniteScroll({
    containerRef: rolesContainerRef,
    onLoadMore: handleLoadMoreRoles,
    hasMore: rolesHasMore,
    loading: rolesLoadingMore,
    threshold: 50,
  });

  const handleChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleRoleChange = useCallback(e => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      roles: checked
        ? [...prev.roles, value]
        : prev.roles.filter(r => r !== value),
    }));
  }, []);

  const handleCancel = useCallback(() => {
    confirmBackModalRef.current && confirmBackModalRef.current.open();
  }, []);

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/groups');
  }, [history]);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError(null);

      if (!formData.name.trim()) {
        setError(t('errors.groupNameRequired', 'Group name is required'));
        return;
      }

      try {
        await dispatch(
          updateGroup({ groupId: group.id, groupData: formData }),
        ).unwrap();
        history.push('/admin/groups');
      } catch (err) {
        setError(err);
      }
    },
    [formData, dispatch, group, history, t],
  );

  // Fetch group data on mount
  useEffect(() => {
    if (groupId) {
      dispatch(fetchGroupById(groupId));
    }
  }, [dispatch, groupId]);

  // Update form data when group is loaded
  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name || '',
        description: group.description || '',
        category: group.category || '',
        type: group.type || '',
        roles:
          Array.isArray(group.roles) && group.roles.length > 0
            ? group.roles
            : [],
      });
    }
  }, [group]);

  // Show loading on first fetch or when still fetching
  if (!fetchInitialized || fetchingGroup) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='folder' size={24} />}
          title='Edit Group'
          subtitle='Modify group details'
        >
          <Button variant='secondary' onClick={handleCancel}>
            ← Back to Groups
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <Loader variant='spinner' message='Loading group data...' />
        </div>
      </div>
    );
  }

  if (!group || groupLoadError) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='folder' size={24} />}
          title='Edit Group'
          subtitle='Modify group details'
        >
          <Button variant='secondary' onClick={handleCancel}>
            ← Back to Groups
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>Failed to load group data</div>
          <div className={s.formActions}>
            <Button variant='secondary' onClick={handleCancel}>
              Back to Groups
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='folder' size={24} />}
        title='Edit Group'
        subtitle='Modify group details'
      >
        <Button variant='secondary' onClick={handleCancel}>
          ← Back to Groups
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <form onSubmit={handleSubmit} className={s.form}>
          {error && <div className={s.formError}>{error}</div>}

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Group Information</h3>

            <div className={s.formGroup}>
              <label htmlFor='name'>Group Name *</label>
              <input
                type='text'
                id='name'
                name='name'
                value={formData.name}
                onChange={handleChange}
                required
                className={s.formInput}
                placeholder='e.g., Engineering, Marketing, Support'
              />
            </div>

            <div className={s.formGroup}>
              <label htmlFor='description'>Description</label>
              <textarea
                id='description'
                name='description'
                value={formData.description}
                onChange={handleChange}
                className={s.formTextarea}
                placeholder='Describe what this group is for...'
                rows={3}
              />
            </div>

            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label htmlFor='category'>Category</label>
                <input
                  type='text'
                  id='category'
                  name='category'
                  value={formData.category}
                  onChange={handleChange}
                  className={s.formInput}
                  placeholder='e.g., System, Organization, Department'
                />
              </div>
              <div className={s.formGroup}>
                <label htmlFor='type'>Type</label>
                <input
                  type='text'
                  id='type'
                  name='type'
                  value={formData.type}
                  onChange={handleChange}
                  className={s.formInput}
                  placeholder='e.g., Security, Organizational, Functional, Default'
                />
              </div>
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>
              Roles ({formData.roles.length} selected)
            </h3>
            <input
              type='text'
              placeholder='Search roles...'
              value={roleSearch}
              onChange={e => setRoleSearch(e.target.value)}
              className={s.searchInput}
            />
            {rolesLoading ? (
              <div className={s.loading}>Loading roles...</div>
            ) : (
              <div ref={rolesContainerRef} className={s.checkboxGroup}>
                {roles.length > 0 ? (
                  <>
                    {roles.map(role => (
                      <label key={role.id} className={s.checkboxItem}>
                        <input
                          type='checkbox'
                          value={role.name}
                          checked={formData.roles.includes(role.name)}
                          onChange={handleRoleChange}
                        />
                        <span>
                          {role.name}
                          {role.description && (
                            <span className={s.itemDescription}>
                              {role.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                    {rolesLoadingMore && (
                      <div className={s.loadingMore}>Loading more...</div>
                    )}
                  </>
                ) : (
                  <div className={s.noItemsFound}>No roles found</div>
                )}
              </div>
            )}
          </div>

          <div className={s.formActions}>
            <Button variant='secondary' onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant='primary' type='submit' loading={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
      <ConfirmModal.Back
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </div>
  );
}

EditGroup.propTypes = {
  groupId: PropTypes.string.isRequired,
};

export default EditGroup;
