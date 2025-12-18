/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from '../../../../components/History';
import { createGroup, fetchRoles } from '../../../../redux';
import {
  useInfiniteScroll,
  useDebounce,
} from '../../../../components/InfiniteScroll';
import s from './CreateGroup.css';

function CreateGroup() {
  const dispatch = useDispatch();
  const history = useHistory();

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
  const [loading, setLoading] = useState(false);

  // Fetch roles with pagination
  const loadRoles = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setRolesLoading(true);
      } else {
        setRolesLoadingMore(true);
      }

      try {
        const result = await dispatch(
          fetchRoles({ page, limit: rolesLimit, search }),
        );
        if (result.success && result.data) {
          const newRoles = result.data.roles || [];
          const { pagination } = result.data;

          if (reset) {
            setRoles(newRoles);
          } else {
            setRoles(prev => [...prev, ...newRoles]);
          }

          setRolesHasMore(pagination && pagination.page < pagination.pages);
          setRolesPage(page);
        }
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
    history.push('/admin/groups');
  }, [history]);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError(null);

      if (!formData.name.trim()) {
        setError('Group name is required');
        return;
      }

      setLoading(true);
      const result = await dispatch(createGroup(formData));
      setLoading(false);

      if (result.success) {
        history.push('/admin/groups');
      } else {
        setError(result.error);
      }
    },
    [dispatch, formData, history],
  );

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h2 className={s.title}>Create New Group</h2>
        <button type='button' onClick={handleCancel} className={s.backBtn}>
          ← Back to Groups
        </button>
      </div>

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
                  placeholder='e.g., Department, Team, Project'
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
                  placeholder='e.g., Internal, External'
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
                          name='roles'
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
            <button
              type='button'
              onClick={handleCancel}
              className={s.cancelBtn}
            >
              Cancel
            </button>
            <button type='submit' disabled={loading} className={s.submitBtn}>
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroup;
