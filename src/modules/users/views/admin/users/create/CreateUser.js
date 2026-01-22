/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../../../../shared/renderer/components/History';
import { createUserFormSchema } from '../../../../../../shared/validator/features/admin';
import {
  generatePassword,
  showSuccessMessage,
} from '../../../../../../shared/renderer/redux';
import { useDebounce } from '../../../../../../shared/renderer/components/InfiniteScroll';
import {
  Box,
  Icon,
  ConfirmModal,
} from '../../../../../../shared/renderer/components/Admin';
import Button from '../../../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../../../shared/renderer/components/Form';
import { fetchRoles } from '../../roles/redux';
import { fetchGroups } from '../../groups/redux';
import { createUser, isUserCreateLoading } from '../redux';
import s from './CreateUser.css';

function CreateUser() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isUserCreateLoading);

  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

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
        await dispatch(createUser(data)).unwrap();
        history.push('/admin/users');
      } catch (err) {
        setError(err || t('errors.createUser', 'Failed to create user'));
      }
    },
    [dispatch, history, t],
  );

  const defaultValues = {
    email: '',
    password: '',
    confirm_password: '',
    display_name: '',
    first_name: '',
    last_name: '',
    roles: [],
    groups: [],
    is_active: true,
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='users' size={24} />}
        title='Create New User'
        subtitle='Add a new user account'
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
          schema={createUserFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <CreateUserFormFields
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
 * CreateUserFormFields - Form fields component that uses react-hook-form context
 */
function CreateUserFormFields({ setError, onCancel, loading, isDirtyRef }) {
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

  // Watch the roles and groups arrays for display count
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
      setValue('confirm_password', password, { shouldValidate: true });
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

        <Form.Field name='email' label='Email' required>
          <Form.Input type='email' placeholder='user@example.com' />
        </Form.Field>

        <div className={s.formRow}>
          <Form.Field name='password' label='Password' required>
            <Form.Password placeholder='Enter password' />
          </Form.Field>
          <Form.Field name='confirm_password' label='Confirm Password' required>
            <Form.Password placeholder='Confirm password' />
          </Form.Field>
        </div>

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
                {t(
                  'admin.users.generateSecurePassword',
                  'Generate Secure Password',
                )}
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
          {loading ? 'Creating...' : 'Create User'}
        </Button>
      </div>
    </>
  );
}

CreateUserFormFields.propTypes = {
  setError: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

export default CreateUser;
