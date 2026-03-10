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
import { useHistory } from '@shared/renderer/components/History';
import {
  generatePassword,
  getUserProfile,
  showSuccessMessage,
} from '@shared/renderer/redux';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import * as Box from '@shared/renderer/components/Box';
import Icon from '@shared/renderer/components/Icon';
import Loader from '@shared/renderer/components/Loader';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import Button from '@shared/renderer/components/Button';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { updateUserFormSchema } from '../../../../validator/admin';
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

function EditUser({ userId, context }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const { container } = context;
  const { fetchRoles } = useMemo(() => {
    const { thunks } = container.resolve('roles:admin:state');
    return thunks;
  }, [container]);
  const { fetchGroups } = useMemo(() => {
    const { thunks } = container.resolve('groups:admin:state');
    return thunks;
  }, [container]);

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
        setError(
          err || t('admin:users.errors.updateUser', 'Failed to update user'),
        );
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
            profile: {
              display_name: (user.profile && user.profile.display_name) || '',
              first_name: (user.profile && user.profile.first_name) || '',
              last_name: (user.profile && user.profile.last_name) || '',
            },
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
          title={t('admin:users.edit.title', 'Edit User')}
          subtitle={t(
            'admin:users.edit.subtitle',
            'Modify user account details',
          )}
        >
          <Button variant='secondary' onClick={() => handleCancel(false)}>
            <Icon name='arrowLeft' />
            {t('admin:users.edit.backToUsers', 'Back to Users')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <Loader
            variant='spinner'
            message={t('admin:users.edit.loadingUser', 'Loading user data...')}
          />
        </div>
      </div>
    );
  }

  if (!user || userLoadError) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='users' size={24} />}
          title={t('admin:users.edit.title', 'Edit User')}
          subtitle={t(
            'admin:users.edit.subtitle',
            'Modify user account details',
          )}
        >
          <Button variant='secondary' onClick={() => handleCancel(false)}>
            <Icon name='arrowLeft' />
            {t('admin:users.edit.backToUsers', 'Back to Users')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>
            {t('admin:users.edit.failedToLoad', 'Failed to load user data')}
          </div>
          <div className={s.formActions}>
            <Button variant='secondary' onClick={() => handleCancel(false)}>
              {t('admin:users.edit.backBtn', 'Back to Users')}
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
          title={t('admin:users.edit.title', 'Edit User')}
          subtitle={t(
            'admin:users.edit.subtitle',
            'Modify user account details',
          )}
        >
          <Button variant='secondary' onClick={() => handleCancel(false)}>
            <Icon name='arrowLeft' />
            {t('admin:users.edit.backToUsers', 'Back to Users')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>
            {t(
              'admin:users.errors.cannotEditSelf',
              'You cannot edit your own account from the admin panel. Please use your profile settings instead.',
            )}
          </div>
          <div className={s.formActions}>
            <Button variant='secondary' onClick={() => handleCancel(false)}>
              {t('admin:users.edit.backBtn', 'Back to Users')}
            </Button>
            <Button variant='primary' onClick={() => history.push('/profile')}>
              {t('admin:users.edit.goToProfile', 'Go to Profile Settings')}
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
        title={t('admin:users.edit.title', 'Edit User')}
        subtitle={t('admin:users.edit.subtitle', 'Modify user account details')}
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <Icon name='arrowLeft' />
          {t('admin:users.edit.backToUsers', 'Back to Users')}
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
            fetchRoles={fetchRoles}
            fetchGroups={fetchGroups}
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
function EditUserFormFields({
  setError,
  onCancel,
  loading,
  isDirtyRef,
  fetchRoles,
  fetchGroups,
}) {
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
    [dispatch, fetchRoles],
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
    [dispatch, fetchGroups],
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
            'admin:users.passwordGenerated',
            'Password generated successfully!',
          ),
        }),
      );
    } catch (err) {
      setError(
        err ||
          t(
            'admin:users.errors.generatePassword',
            'Failed to generate password',
          ),
      );
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch, setValue, setError, t]);

  return (
    <>
      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:users.edit.accountInfo', 'Account Information')}
        </h3>

        <Form.Field name='email' label={t('admin:users.edit.email', 'Email')}>
          <Form.Input type='email' disabled />
        </Form.Field>

        <Form.Field
          name='password'
          label={t('admin:users.edit.newPassword', 'New Password (optional)')}
        >
          <Form.Password
            placeholder={t(
              'admin:users.edit.newPasswordPlaceholder',
              'Leave empty to keep current password',
            )}
          />
        </Form.Field>

        <Form.Field
          name='password_confirmation'
          label={t(
            'admin:users.edit.confirmNewPassword',
            'Confirm New Password',
          )}
        >
          <Form.Password
            placeholder={t(
              'admin:users.edit.confirmNewPasswordPlaceholder',
              'Confirm new password',
            )}
          />
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
              t('admin:users.generatingPassword', 'Generating...')
            ) : (
              <>
                <Icon name='key' size={14} />
                {t('admin:users.generateNewPassword', 'Generate New Password')}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:users.edit.personalInfo', 'Personal Information')}
        </h3>

        <div className={s.formRow}>
          <Form.Field
            name='profile.first_name'
            label={t('admin:users.edit.firstName', 'First Name')}
          >
            <Form.Input
              placeholder={t('admin:users.edit.firstNamePlaceholder', 'John')}
            />
          </Form.Field>
          <Form.Field
            name='profile.last_name'
            label={t('admin:users.edit.lastName', 'Last Name')}
          >
            <Form.Input
              placeholder={t('admin:users.edit.lastNamePlaceholder', 'Doe')}
            />
          </Form.Field>
        </div>

        <Form.Field
          name='profile.display_name'
          label={t('admin:users.edit.displayName', 'Display Name')}
        >
          <Form.Input
            placeholder={t(
              'admin:users.edit.displayNamePlaceholder',
              'John Doe',
            )}
          />
        </Form.Field>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:users.edit.accessAndPermissions', 'Access & Permissions')}
        </h3>

        <Form.Field
          name='roles'
          label={t(
            'admin:users.edit.rolesSelected',
            'Roles ({{count}} selected)',
            { count: selectedRoles.length },
          )}
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
            searchPlaceholder={t(
              'admin:users.edit.searchRoles',
              'Search roles...',
            )}
            valueKey='name'
            labelKey='name'
            itemDescription='description'
            emptyMessage={t('admin:users.edit.noRolesFound', 'No roles found')}
            loadingMessage={t(
              'admin:users.edit.loadingRoles',
              'Loading roles...',
            )}
          />
        </Form.Field>

        <Form.Field
          name='groups'
          label={t(
            'admin:users.edit.groupsSelected',
            'Groups ({{count}} selected)',
            { count: selectedGroups.length },
          )}
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
            searchPlaceholder={t(
              'admin:users.edit.searchGroups',
              'Search groups...',
            )}
            valueKey='id'
            labelKey='name'
            itemDescription='description'
            emptyMessage={t(
              'admin:users.edit.noGroupsFound',
              'No groups found',
            )}
            loadingMessage={t(
              'admin:users.edit.loadingGroups',
              'Loading groups...',
            )}
          />
        </Form.Field>

        <Form.Field name='is_active'>
          <Form.Checkbox label={t('admin:users.edit.active', 'Active')} />
        </Form.Field>
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel}>
          {t('admin:users.edit.cancel', 'Cancel')}
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading
            ? t('admin:users.edit.saving', 'Saving...')
            : t('admin:users.edit.saveChanges', 'Save Changes')}
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
  fetchRoles: PropTypes.func.isRequired,
  fetchGroups: PropTypes.func.isRequired,
};

EditUser.propTypes = {
  userId: PropTypes.string.isRequired,
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default EditUser;
