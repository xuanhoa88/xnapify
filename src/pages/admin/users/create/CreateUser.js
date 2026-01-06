/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../../components/History';
import {
  createUser,
  fetchRoles,
  fetchGroups,
  generatePassword,
  isUserCreateLoading,
} from '../../../../redux';
import {
  useInfiniteScroll,
  useDebounce,
} from '../../../../components/InfiniteScroll';
import { Box, Icon, ConfirmModal } from '../../../../components/Admin';
import Button from '../../../../components/Button';
import s from './CreateUser.css';

function CreateUser() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isUserCreateLoading);

  // Roles state for infinite loading
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadingMore, setRolesLoadingMore] = useState(false);
  const [rolesHasMore, setRolesHasMore] = useState(false);
  const [rolesPage, setRolesPage] = useState(1);
  const rolesLimit = 10;
  const rolesContainerRef = useRef(null);

  // Groups state for infinite loading
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsLoadingMore, setGroupsLoadingMore] = useState(false);
  const [groupsHasMore, setGroupsHasMore] = useState(false);
  const [groupsPage, setGroupsPage] = useState(1);
  const groupsLimit = 10;
  const groupsContainerRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    display_name: '',
    first_name: '',
    last_name: '',
    roles: [],
    groups: [],
    is_active: true,
  });
  const [error, setError] = useState(null);
  const [roleSearch, setRoleSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatingPassword, setGeneratingPassword] = useState(false);
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

  // Fetch groups with pagination
  const loadGroups = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setGroupsLoading(true);
      } else {
        setGroupsLoadingMore(true);
      }

      try {
        const data = await dispatch(
          fetchGroups({ page, limit: groupsLimit, search }),
        ).unwrap();
        const newGroups = data.groups || [];
        const { pagination } = data;

        if (reset) {
          setGroups(newGroups);
        } else {
          setGroups(prev => [...prev, ...newGroups]);
        }

        setGroupsHasMore(pagination && pagination.page < pagination.pages);
        setGroupsPage(page);
      } catch (err) {
        // Silently handle error
      } finally {
        setGroupsLoading(false);
        setGroupsLoadingMore(false);
      }
    },
    [dispatch],
  );

  // Debounced group search using RxJS (also handles initial load on mount)
  useDebounce(groupSearch, 300, debouncedSearch => {
    loadGroups(1, debouncedSearch, true);
  });

  // Load more groups handler
  const handleLoadMoreGroups = useCallback(() => {
    if (!groupsLoadingMore && groupsHasMore) {
      loadGroups(groupsPage + 1, groupSearch, false);
    }
  }, [groupsLoadingMore, groupsHasMore, groupsPage, groupSearch, loadGroups]);

  // RxJS-based infinite scroll for groups
  useInfiniteScroll({
    containerRef: groupsContainerRef,
    onLoadMore: handleLoadMoreGroups,
    hasMore: groupsHasMore,
    loading: groupsLoadingMore,
    threshold: 50,
  });

  const handleChange = useCallback(e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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

  const handleGroupChange = useCallback(e => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      groups: checked
        ? [...prev.groups, value]
        : prev.groups.filter(g => g !== value),
    }));
  }, []);

  const handleCancel = useCallback(() => {
    confirmBackModalRef.current && confirmBackModalRef.current.open();
  }, []);

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/users');
  }, [history]);

  const handleGeneratePassword = useCallback(async () => {
    setGeneratingPassword(true);
    try {
      const password = await dispatch(generatePassword()).unwrap();
      setFormData(prev => ({
        ...prev,
        password: password,
        confirm_password: password,
      }));
      setShowPassword(true);
    } catch (err) {
      setError(
        err || t('errors.generatePassword', 'Failed to generate password'),
      );
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch, t]);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError(null);

      if (formData.password !== formData.confirm_password) {
        setError(t('errors.passwordMatch', 'Passwords do not match'));
        return;
      }

      if (formData.roles.length === 0) {
        setError(t('errors.selectRole', 'Please select at least one role'));
        return;
      }

      try {
        await dispatch(createUser(formData)).unwrap();
        history.push('/admin/users');
      } catch (err) {
        setError(err);
      }
    },
    [dispatch, formData, history, t],
  );

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='users' size={24} />}
        title='Create New User'
        subtitle='Add a new user account'
      >
        <Button variant='secondary' onClick={handleCancel}>
          ← Back to Users
        </Button>
      </Box.Header>
      <div className={s.formContainer}>
        <form onSubmit={handleSubmit} className={s.form}>
          {error && <div className={s.formError}>{error}</div>}

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Account Information</h3>

            <div className={s.formGroup}>
              <label htmlFor='email'>Email *</label>
              <input
                type='email'
                id='email'
                name='email'
                value={formData.email}
                onChange={handleChange}
                required
                className={s.formInput}
                placeholder='user@example.com'
              />
            </div>

            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label htmlFor='password'>Password *</label>
                <div className={s.passwordInputWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id='password'
                    name='password'
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className={s.formInput}
                    placeholder='Enter password'
                  />
                  <Button
                    variant='ghost'
                    size='small'
                    iconOnly
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <Icon name='eyeOff' size={18} />
                    ) : (
                      <Icon name='eye' size={18} />
                    )}
                  </Button>
                </div>
              </div>
              <div className={s.formGroup}>
                <label htmlFor='confirm_password'>Confirm Password *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id='confirm_password'
                  name='confirm_password'
                  value={formData.confirm_password}
                  onChange={handleChange}
                  required
                  className={s.formInput}
                  placeholder='Confirm password'
                />
              </div>
            </div>

            <div className={s.generatePasswordRow}>
              <Button
                variant='secondary'
                size='small'
                onClick={handleGeneratePassword}
                disabled={generatingPassword}
                className={s.generateBtn}
              >
                {generatingPassword ? (
                  'Generating...'
                ) : (
                  <>
                    <Icon name='key' size={14} /> Generate Secure Password
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Personal Information</h3>

            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label htmlFor='first_name'>First Name</label>
                <input
                  type='text'
                  id='first_name'
                  name='first_name'
                  value={formData.first_name}
                  onChange={handleChange}
                  className={s.formInput}
                  placeholder='John'
                />
              </div>
              <div className={s.formGroup}>
                <label htmlFor='last_name'>Last Name</label>
                <input
                  type='text'
                  id='last_name'
                  name='last_name'
                  value={formData.last_name}
                  onChange={handleChange}
                  className={s.formInput}
                  placeholder='Doe'
                />
              </div>
            </div>

            <div className={s.formGroup}>
              <label htmlFor='display_name'>Display Name</label>
              <input
                type='text'
                id='display_name'
                name='display_name'
                value={formData.display_name}
                onChange={handleChange}
                className={s.formInput}
                placeholder='John Doe'
              />
            </div>
          </div>

          <div className={s.formSection}>
            <h3 className={s.sectionTitle}>Access & Permissions</h3>

            <div className={s.formGroup}>
              <label htmlFor='roles'>
                Roles ({formData.roles.length} selected)
              </label>
              <input
                type='text'
                placeholder='Search roles...'
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                className={s.searchInput}
              />
              {rolesLoading ? (
                <div className={s.itemsLoading}>Loading roles...</div>
              ) : (
                <div ref={rolesContainerRef} className={s.checkboxGroup}>
                  {roles.length > 0 ? (
                    <>
                      {roles.map(role => (
                        <label key={role.name} className={s.checkboxItem}>
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

            <div className={s.formGroup}>
              <label htmlFor='groups'>
                Groups ({formData.groups.length} selected)
              </label>
              <input
                type='text'
                placeholder='Search groups...'
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className={s.searchInput}
              />
              {groupsLoading ? (
                <div className={s.itemsLoading}>Loading groups...</div>
              ) : (
                <div ref={groupsContainerRef} className={s.checkboxGroup}>
                  {groups.length > 0 ? (
                    <>
                      {groups.map(group => (
                        <label key={group.id} className={s.checkboxItem}>
                          <input
                            type='checkbox'
                            name='groups'
                            value={group.id}
                            checked={formData.groups.includes(group.id)}
                            onChange={handleGroupChange}
                          />
                          <span>
                            {group.name}
                            {group.description && (
                              <span className={s.itemDescription}>
                                {group.description}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                      {groupsLoadingMore && (
                        <div className={s.loadingMore}>Loading more...</div>
                      )}
                    </>
                  ) : (
                    <div className={s.noItemsFound}>No groups found</div>
                  )}
                </div>
              )}
            </div>

            <div className={s.formGroupCheckbox}>
              <label htmlFor='is_active'>
                <input
                  type='checkbox'
                  id='is_active'
                  name='is_active'
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                Active
              </label>
            </div>
          </div>

          <div className={s.formActions}>
            <Button variant='secondary' onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant='primary' type='submit' loading={loading}>
              {loading ? 'Creating...' : 'Create User'}
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

export default CreateUser;
