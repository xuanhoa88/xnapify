/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../../components/History';
import {
  createRole,
  fetchPermissions,
  isRoleCreateLoading,
} from '../../../../redux';
import {
  useInfiniteScroll,
  useDebounce,
} from '../../../../components/InfiniteScroll';
import { Box, Icon, ConfirmModal } from '../../../../components/Admin';
import Button from '../../../../components/Button';
import s from './CreateRole.css';

function CreateRole() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isRoleCreateLoading);

  // Permissions state for infinite loading
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsLoadingMore, setPermissionsLoadingMore] = useState(false);
  const [permissionsHasMore, setPermissionsHasMore] = useState(false);
  const [permissionsPage, setPermissionsPage] = useState(1);
  const permissionsLimit = 20;
  const permissionsContainerRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
  });
  const [error, setError] = useState(null);
  const [permissionSearch, setPermissionSearch] = useState('');
  const confirmBackModalRef = useRef(null);

  // Fetch permissions with pagination
  const loadPermissions = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setPermissionsLoading(true);
      } else {
        setPermissionsLoadingMore(true);
      }

      try {
        const data = await dispatch(
          fetchPermissions({ page, limit: permissionsLimit, search }),
        ).unwrap();
        const newPermissions = data.permissions || [];
        const { pagination } = data;

        if (reset) {
          setPermissions(newPermissions);
        } else {
          setPermissions(prev => [...prev, ...newPermissions]);
        }

        setPermissionsHasMore(pagination && pagination.page < pagination.pages);
        setPermissionsPage(page);
      } catch (err) {
        // Silently handle permission loading errors
      } finally {
        setPermissionsLoading(false);
        setPermissionsLoadingMore(false);
      }
    },
    [dispatch],
  );

  // Debounced permission search using RxJS (also handles initial load on mount)
  useDebounce(permissionSearch, 300, debouncedSearch => {
    loadPermissions(1, debouncedSearch, true);
  });

  // Load more permissions handler
  const handleLoadMorePermissions = useCallback(() => {
    if (!permissionsLoadingMore && permissionsHasMore) {
      loadPermissions(permissionsPage + 1, permissionSearch, false);
    }
  }, [
    permissionsLoadingMore,
    permissionsHasMore,
    permissionsPage,
    permissionSearch,
    loadPermissions,
  ]);

  // RxJS-based infinite scroll for permissions
  useInfiniteScroll({
    containerRef: permissionsContainerRef,
    onLoadMore: handleLoadMorePermissions,
    hasMore: permissionsHasMore,
    loading: permissionsLoadingMore,
    threshold: 50,
  });

  const handleChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handlePermissionChange = useCallback(e => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, value]
        : prev.permissions.filter(p => p !== value),
    }));
  }, []);

  const handleCancel = useCallback(() => {
    confirmBackModalRef.current && confirmBackModalRef.current.open();
  }, []);

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/roles');
  }, [history]);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError(null);

      if (!formData.name.trim()) {
        setError(t('errors.roleNameRequired', 'Role name is required'));
        return;
      }

      try {
        await dispatch(createRole(formData)).unwrap();
        history.push('/admin/roles');
      } catch (err) {
        setError(err);
      }
    },
    [dispatch, formData, history, t],
  );

  // Group permissions by resource for better organization
  const groupedPermissions = useMemo(() => {
    const grouped = {};
    permissions.forEach(permission => {
      const resource = permission.resource || 'Other';
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(permission);
    });
    return grouped;
  }, [permissions]);

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='shield' size={24} />}
        title='Create New Role'
        subtitle='Define a new access level'
      >
        <Button variant='secondary' onClick={handleCancel}>
          ← Back to Roles
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <form onSubmit={handleSubmit} className={s.form}>
          {error && <div className={s.formError}>{error}</div>}

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Role Information</h3>

            <div className={s.formGroup}>
              <label htmlFor='name'>Role Name *</label>
              <input
                type='text'
                id='name'
                name='name'
                value={formData.name}
                onChange={handleChange}
                required
                className={s.formInput}
                placeholder='e.g., editor, moderator, viewer'
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
                placeholder='Describe what this role is for...'
                rows={3}
              />
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>
              Permissions ({formData.permissions.length} selected)
            </h3>

            <div className={s.formGroup}>
              <input
                type='text'
                placeholder='Search e.g. users, users:read, :create'
                value={permissionSearch}
                onChange={e => setPermissionSearch(e.target.value)}
                className={s.searchInput}
              />
              {permissionsLoading ? (
                <div className={s.itemsLoading}>Loading permissions...</div>
              ) : (
                <div
                  ref={permissionsContainerRef}
                  className={s.permissionsContainer}
                >
                  {Object.keys(groupedPermissions).length > 0 ? (
                    <>
                      {Object.entries(groupedPermissions).map(
                        ([resource, perms]) => (
                          <div key={resource} className={s.permissionGroup}>
                            <h4 className={s.resourceTitle}>{resource}</h4>
                            <div className={s.checkboxGroup}>
                              {perms.map(permission => (
                                <label
                                  key={permission.id}
                                  className={s.checkboxItem}
                                >
                                  <input
                                    type='checkbox'
                                    name='permissions'
                                    value={permission.id}
                                    checked={formData.permissions.includes(
                                      permission.id,
                                    )}
                                    onChange={handlePermissionChange}
                                  />
                                  <span>
                                    <span className={s.permissionName}>
                                      {permission.action}
                                    </span>
                                    {permission.description && (
                                      <span className={s.itemDescription}>
                                        {permission.description}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                      {permissionsLoadingMore && (
                        <div className={s.loadingMore}>Loading more...</div>
                      )}
                    </>
                  ) : (
                    <div className={s.noItemsFound}>No permissions found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={s.formActions}>
            <Button variant='secondary' onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant='primary' type='submit' loading={loading}>
              {loading ? 'Creating...' : 'Create Role'}
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

export default CreateRole;
