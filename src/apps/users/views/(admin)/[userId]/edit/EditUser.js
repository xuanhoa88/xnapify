/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { GroupIcon, LockOpen1Icon } from '@radix-ui/react-icons';
import { Box, Flex, Text, Grid, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

// import { Flex, Heading, Text, Box } from '@radix-ui/themes';
// import { Button } from '@radix-ui/themes';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import Modal from '@shared/renderer/components/Modal';
import { generatePassword, showSuccessMessage } from '@shared/renderer/redux';

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
  const loading = useSelector(isUserUpdateLoading);
  const fetchingUser = useSelector(isUserFetchLoading);
  const fetchInitialized = useSelector(isUserFetchInitialized);
  const user = useSelector(getFetchedUser);
  const userLoadError = useSelector(getUserFetchError);

  const [, setError] = useState(null);
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
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(
          updateUser({ userId: user.id, userData: data }),
        ).unwrap();
        history.push('/admin/users');
      } catch (err) {
        if (err && typeof err === 'object' && err.errors) {
          // It's a validation error object with field-specific errors
          Object.keys(err.errors).forEach(key => {
            if (methods && typeof methods.setError === 'function') {
              methods.setError(key, {
                type: 'server',
                message: err.errors[key],
              });
            }
          });
        } else {
          // General string error or object without errors dictionary
          setError(
            err || t('admin:users.errors.updateUser', 'Failed to update user'),
          );
        }
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
      <Box className={s.container}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          pb='4'
          mb='6'
          className={s.adminHeader}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.adminHeaderIcon}>
              <GroupIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>{null}</Heading>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    );
  }

  if (!user || userLoadError) {
    return (
      <Box className={s.container}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          pb='4'
          mb='6'
          className={s.adminHeader}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.adminHeaderIcon}>
              <GroupIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>{null}</Heading>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className={s.container}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        pb='4'
        mb='6'
        className={s.adminHeader}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.adminHeaderIcon}>
            <GroupIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {(user.profile && user.profile.display_name) || user.email}
            </Heading>
            <Text size='2' color='gray'>
              {user.email}
            </Text>
          </Flex>
        </Flex>
      </Flex>

      <Form
        schema={updateUserFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        className='edit-user-form'
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

      <Modal.ConfirmBack
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </Box>
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
      <Box className={s.sectionBox}>
        <Text as='h3' size='4' weight='bold' className={s.sectionHeader}>
          {t('admin:users.edit.accountInfo', 'Account Information')}
        </Text>

        <Form.Field
          name='email'
          label={t('admin:users.edit.email', 'Email')}
          className={s.fieldMarginBottom0}
        >
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

        <Flex justify='end'>
          <Button
            variant='ghost'
            size='1'
            onClick={handleGeneratePassword}
            disabled={generatingPassword}
            className={s.buttonGhost}
          >
            {generatingPassword ? (
              t('admin:users.generatingPassword', 'Generating...')
            ) : (
              <>
                <LockOpen1Icon width={14} height={14} />
                {t('admin:users.generateNewPassword', 'Generate New Password')}
              </>
            )}
          </Button>
        </Flex>
      </Box>

      <Box className={s.sectionBox}>
        <Text as='h3' size='4' weight='bold' className={s.sectionHeader}>
          {t('admin:users.edit.personalInfo', 'Personal Information')}
        </Text>

        <Grid columns={{ initial: '1', sm: '2' }} gap='4'>
          <Form.Field
            name='profile.first_name'
            label={t('admin:users.edit.firstName', 'First Name')}
            className={s.fieldMarginBottom0}
          >
            <Form.Input
              placeholder={t('admin:users.edit.firstNamePlaceholder', 'John')}
            />
          </Form.Field>
          <Form.Field
            name='profile.last_name'
            label={t('admin:users.edit.lastName', 'Last Name')}
            className={s.fieldMarginBottom0}
          >
            <Form.Input
              placeholder={t('admin:users.edit.lastNamePlaceholder', 'Doe')}
            />
          </Form.Field>
        </Grid>

        <Form.Field
          name='profile.display_name'
          label={t('admin:users.edit.displayName', 'Display Name')}
          className={s.fieldMarginTop}
        >
          <Form.Input
            placeholder={t(
              'admin:users.edit.displayNamePlaceholder',
              'John Doe',
            )}
          />
        </Form.Field>
      </Box>

      <Box className={s.sectionBoxSmall}>
        <Text as='h3' size='4' weight='bold' className={s.sectionHeader}>
          {t('admin:users.edit.accessAndPermissions', 'Access & Permissions')}
        </Text>

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
      </Box>

      <Flex align='center' justify='between' className={s.footerFlex}>
        <Button variant='soft' color='gray' onClick={handleCancel}>
          {t('admin:users.edit.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          {loading
            ? t('admin:users.edit.saving', 'Saving...')
            : t('admin:users.edit.saveChanges', 'Save Changes')}
        </Button>
      </Flex>
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
