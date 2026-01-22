/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../../../../../shared/renderer/components/History';
import { updateUserFormSchema } from '../../../../../../../shared/validator/features/admin';
import {
  generatePassword,
  getUserProfile,
  showSuccessMessage,
} from '../../../../../../../shared/renderer/redux';
import { useDebounce } from '../../../../../../../shared/renderer/components/InfiniteScroll';
import {
  Box,
  Icon,
  Loader,
  ConfirmModal,
} from '../../../../../../../shared/renderer/components/Admin';
import Button from '../../../../../../../shared/renderer/components/Button';
import Form, { useFormContext } from '../../../../../../../shared/renderer/components/Form';
import { fetchRoles } from '../../../roles/redux';
import { fetchGroups } from '../../../groups/redux';
import {
  updateUser,
  fetchUserById,
  isUserUpdateLoading,
  isUserFetchLoading,
  isUserFetchInitialized,
  getFetchedUser,
  getUserFetchError,
} from '../../redux';
import s from './EditUser.css';

function EditUser({ userId }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const currentUser = useSelector(getUserProfile);
  const loading = useSelector(isUserUpdateLoading);
  const fetchingUser = useSelector(isUserFetchLoading);
  const fetchInitialized = useSelector(isUserFetchInitialized);
  const user = useSelector(getFetchedUser);
  const userLoadError = useSelector(getUserFetchError);

  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  // Fetch user data on mount
  useEffect(() => {
    if (userId) {
      dispatch(fetchUserById(userId));
    }
  }, [dispatch, userId]);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/users');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/users');
  }, [history]);

  const handleSubmit = useCallback(
    async data => {
      setError(null);

      try {
        await dispatch(
          updateUser({ userId: user.id, userData: data }),
        ).unwrap();
        history.push('/admin/users');
      } catch (err) {
        setError(err || t('errors.updateUser', 'Failed to update user'));
      }
    },
    [dispatch, user, history, t],
  );

  // Build default values from user data (memoized to prevent Form re-renders)
  // Must be called before early returns to follow Rules of Hooks
  const defaultValues = useMemo(
    () =>
      user
        ? {
            email: user.email || '',
            display_name: user.display_name || '',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            roles:
              Array.isArray(user.roles) && user.roles.length > 0
                ? user.roles
                : [],
            groups:
              Array.isArray(user.groups) && user.groups.length > 0
                ? user.groups.map(g => g.id)
                : [],
            is_active: user.is_active,
          }
        : {},
    [user],
  );

  // Show loading on first fetch or when still fetching
  if (!fetchInitialized || fetchingUser) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='users' size={24} />}
          title='Edit User'
          subtitle='Modify user account details'
        >
          <Button variant='secondary' onClick={() => handleCancel(false)}>
            ← Back to Users
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <Loader variant='spinner' message='Loading user data...' />
        </div>
      </div>
    );
  }

  if (!user || userLoadError) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='users' size={24} />}
          title='Edit User'
          subtitle='Modify user account details'
        >
          <Button variant='secondary' onClick={() => handleCancel(false)}>
            ← Back to Users
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>Failed to load user data</div>
          <div className={s.formActions}>
            <Button variant='secondary' onClick={() => handleCancel(false)}>
              Back to Users
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Prevent admin from editing their own account
  if (currentUser && currentUser.id === userId) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='users' size={24} />}
          title='Edit User'
          subtitle='Modify user account details'
        >
          <Button variant='secondary' onClick={() => handleCancel(false)}>
            ← Back to Users
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>
            {t(
              'errors.cannotEditSelf',
              'You cannot edit your own account from the admin panel. Please use your profile settings instead.',
            )}
          </div>
          <div className={s.formActions}>
            <Button variant='secondary' onClick={() => handleCancel(false)}>
              Back to Users
            </Button>
            <Button variant='primary' onClick={() => history.push('/profile')}>
              Go to Profile Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='users' size={24} />}
        title='Edit User'
        subtitle='Modify user account details'
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          ← Back to Users
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <Form.Error message={error} />

        <Form
          schema={updateUserFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <EditUserFormFields
            setError={setError}
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
          />
        </Form>
      </div>
      <ConfirmModal.Back
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </div>
  );
}

/**
 * EditUserFormFields - Form fields component that uses react-hook-form context
 * Contains all the form fields and manages roles/groups state internally
 */
function EditUserFormFields({ setError, onCancel, loading, isDirtyRef }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const {
    watch,
    setValue,
    formState: { isDirty },
  } = useFormContext();

  // Keep isDirtyRef in sync with form dirty state
  isDirtyRef.current = isDirty;

  // Wrap onCancel to check dirty state
  const handleCancel = useCallback(() => {
    onCancel(isDirty);
  }, [onCancel, isDirty]);

  // Roles state for infinite loading
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadingMore, setRolesLoadingMore] = useState(false);
  const [rolesHasMore, setRolesHasMore] = useState(false);
  const [rolesPage, setRolesPage] = useState(1);
  const rolesLimit = 10;

  // Groups state for infinite loading
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsLoadingMore, setGroupsLoadingMore] = useState(false);
  const [groupsHasMore, setGroupsHasMore] = useState(false);
  const [groupsPage, setGroupsPage] = useState(1);
  const groupsLimit = 10;

  // Search state
  const [roleSearch, setRoleSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // Password generation state
  const [generatingPassword, setGeneratingPassword] = useState(false);

  // Watch the roles and groups arrays for the custom checkbox lists
  const selectedRoles = watch('roles') || [];
  const selectedGroups = watch('groups') || [];

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

  const handleGeneratePassword = useCallback(async () => {
    setGeneratingPassword(true);
    try {
      const password = await dispatch(generatePassword()).unwrap();
      setValue('password', password, { shouldValidate: true });
      setValue('password_confirmation', password, { shouldValidate: true });
      dispatch(
        showSuccessMessage({
          message: t(
            'admin.users.passwordGenerated',
            'Password generated successfully!',
          ),
        }),
      );
    } catch (err) {
      setError(
        err || t('errors.generatePassword', 'Failed to generate password'),
      );
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch, setValue, setError, t]);

  return (
    <>
      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>Account Information</h3>

        <Form.Field name='email' label='Email'>
          <Form.Input type='email' disabled />
        </Form.Field>

        <Form.Field name='password' label='New Password (optional)'>
          <Form.Password placeholder='Leave empty to keep current password' />
        </Form.Field>

        <Form.Field name='password_confirmation' label='Confirm New Password'>
          <Form.Password placeholder='Confirm new password' />
        </Form.Field>

        <div className={s.generatePasswordLink}>
          <Button
            variant='unstyled'
            size='small'
            onClick={handleGeneratePassword}
            disabled={generatingPassword}
            className={s.generateBtn}
          >
            {generatingPassword ? (
              t('admin.users.generatingPassword', 'Generating...')
            ) : (
              <>
                <Icon name='key' size={14} />
                {t('admin.users.generateNewPassword', 'Generate New Password')}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>Personal Information</h3>

        <div className={s.formRow}>
          <Form.Field name='first_name' label='First Name'>
            <Form.Input placeholder='John' />
          </Form.Field>
          <Form.Field name='last_name' label='Last Name'>
            <Form.Input placeholder='Doe' />
          </Form.Field>
        </div>

        <Form.Field name='display_name' label='Display Name'>
          <Form.Input placeholder='John Doe' />
        </Form.Field>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>Access &amp; Permissions</h3>

        <Form.Field
          name='roles'
          label={`Roles (${selectedRoles.length} selected)`}
        >
          <Form.CheckboxList
            items={roles}
            loading={rolesLoading}
            loadingMore={rolesLoadingMore}
            hasMore={rolesHasMore}
            onLoadMore={handleLoadMoreRoles}
            searchable
            searchValue={roleSearch}
            onSearch={setRoleSearch}
            searchPlaceholder='Search roles...'
            valueKey='name'
            labelKey='name'
            itemDescription='description'
            emptyMessage='No roles found'
            loadingMessage='Loading roles...'
          />
        </Form.Field>

        <Form.Field
          name='groups'
          label={`Groups (${selectedGroups.length} selected)`}
        >
          <Form.CheckboxList
            items={groups}
            loading={groupsLoading}
            loadingMore={groupsLoadingMore}
            hasMore={groupsHasMore}
            onLoadMore={handleLoadMoreGroups}
            searchable
            searchValue={groupSearch}
            onSearch={setGroupSearch}
            searchPlaceholder='Search groups...'
            valueKey='id'
            labelKey='name'
            itemDescription='description'
            emptyMessage='No groups found'
            loadingMessage='Loading groups...'
          />
        </Form.Field>

        <Form.Field name='is_active'>
          <Form.Checkbox label='Active' />
        </Form.Field>
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </>
  );
}

EditUserFormFields.propTypes = {
  setError: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

EditUser.propTypes = {
  userId: PropTypes.string.isRequired,
};

export default EditUser;
