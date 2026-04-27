/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  PersonIcon,
  LockOpen1Icon,
  CheckCircledIcon,
  CrossCircledIcon,
} from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Grid,
  Button,
  Card,
  Avatar,
  Badge,
  Separator,
} from '@radix-ui/themes';
import format from 'date-fns/format';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import Loader from '@shared/renderer/components/Loader';
import Modal from '@shared/renderer/components/Modal';
import { PageHeader } from '@shared/renderer/components/PageHeader';
import { features } from '@shared/renderer/redux';

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

const { generatePassword, showSuccessMessage, showErrorMessage } = features;

// =============================================================================
// Identity sidebar card — shows existing user metadata
// =============================================================================

function EditUserIdentityCard({ user }) {
  const { t } = useTranslation();

  const displayName =
    (user.profile && user.profile.display_name) || user.email;
  const fullName =
    [
      user.profile && user.profile.first_name,
      user.profile && user.profile.last_name,
    ]
      .filter(Boolean)
      .join(' ') || null;
  const fallback = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <Card variant='surface'>
      <Flex direction='column' align='center' p='5' gap='4'>
        <Avatar
          size='6'
          name={displayName}
          fallback={fallback}
          radius='full'
          color='indigo'
        />

        <Flex direction='column' align='center' gap='1' className='w-full'>
          <Text size='4' weight='bold' align='center' className='break-all'>
            {displayName}
          </Text>
          {fullName && (
            <Text size='2' color='gray' align='center'>
              {fullName}
            </Text>
          )}
          {user.email && displayName !== user.email && (
            <Text size='2' color='gray' align='center' className='break-all'>
              {user.email}
            </Text>
          )}
        </Flex>

        <Separator size='4' />

        <Flex direction='column' gap='3' className='w-full'>
          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:users.edit.status', 'Status')}
            </Text>
            {user.is_active ? (
              <Badge color='green' variant='soft' radius='full' size='1'>
                <CheckCircledIcon width={12} height={12} />
                {t('admin:users.edit.active', 'Active')}
              </Badge>
            ) : (
              <Badge color='gray' variant='soft' radius='full' size='1'>
                <CrossCircledIcon width={12} height={12} />
                {t('admin:users.edit.inactive', 'Inactive')}
              </Badge>
            )}
          </Flex>

          {user.roles && user.roles.length > 0 && (
            <Flex justify='between' align='start' gap='2'>
              <Text size='2' color='gray' className='shrink-0'>
                {t('admin:users.edit.roles', 'Roles')}
              </Text>
              <Flex wrap='wrap' gap='1' justify='end'>
                {user.roles.slice(0, 3).map(role => (
                  <Badge
                    key={role}
                    size='1'
                    color='indigo'
                    variant='soft'
                    radius='full'
                  >
                    {role}
                  </Badge>
                ))}
                {user.roles.length > 3 && (
                  <Badge size='1' color='gray' variant='soft' radius='full'>
                    +{user.roles.length - 3}
                  </Badge>
                )}
              </Flex>
            </Flex>
          )}

          {user.created_at && (
            <Flex justify='between' align='center'>
              <Text size='2' color='gray'>
                {t('admin:users.edit.joined', 'Joined')}
              </Text>
              <Text size='2' color='gray'>
                {format(new Date(user.created_at), 'MMM dd, yyyy')}
              </Text>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Card>
  );
}

EditUserIdentityCard.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    is_active: PropTypes.bool,
    roles: PropTypes.arrayOf(PropTypes.string),
    created_at: PropTypes.string,
    profile: PropTypes.shape({
      display_name: PropTypes.string,
      first_name: PropTypes.string,
      last_name: PropTypes.string,
    }),
  }).isRequired,
};

// =============================================================================
// Main EditUser component
// =============================================================================

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
          Object.keys(err.errors).forEach(key => {
            if (methods && typeof methods.setError === 'function') {
              methods.setError(key, {
                type: 'server',
                message: err.errors[key],
              });
            }
          });
        } else {
          const message =
            (typeof err === 'string' ? err : err?.message) ||
            t('admin:users.errors.updateUser', 'Failed to update user');
          setError(message);
          dispatch(showErrorMessage({ message }));
        }
      }
    },
    [dispatch, user, history, t],
  );

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

  // ── Loading state ──────────────────────────────────────────────────
  if (!fetchInitialized || fetchingUser) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <PageHeader
          title={t('admin:users.edit.title', 'Edit User')}
          subtitle={t(
            'admin:users.edit.subtitle',
            'Update user account and permissions',
          )}
          icon={<PersonIcon width={24} height={24} />}
        />
        <Grid
          columns={{ initial: '1', lg: '280px 1fr' }}
          gap='6'
          align='start'
        >
          <Loader variant='skeleton' skeletonCount={3} />
          <Loader variant='skeleton' skeletonCount={6} />
        </Grid>
      </Box>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (!user || userLoadError) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <PageHeader
          title={t('admin:users.edit.title', 'Edit User')}
          subtitle={t(
            'admin:users.edit.subtitle',
            'Update user account and permissions',
          )}
          icon={<PersonIcon width={24} height={24} />}
        />
        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className='rounded-md'
          style={{
            border: '1px solid var(--red-6)',
            backgroundColor: 'var(--red-2)',
          }}
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('admin:users.edit.errorLoading', 'Error loading user')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {userLoadError ||
              t(
                'admin:users.edit.errorLoadingDescription',
                'The user could not be found or loaded.',
              )}
          </Text>
          <Button
            variant='soft'
            color='red'
            onClick={() => dispatch(fetchUserById(userId))}
          >
            {t('common:retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <PageHeader
        title={(user.profile && user.profile.display_name) || user.email}
        subtitle={user.email}
        icon={<PersonIcon width={24} height={24} />}
      >
        <Button
          variant='ghost'
          color='gray'
          onClick={() => history.push('/admin/users')}
        >
          {t('admin:users.edit.backToList', 'Back to Users')}
        </Button>
      </PageHeader>

      <Form
        schema={updateUserFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <Grid
          columns={{ initial: '1', lg: '280px 1fr' }}
          gap='6'
          align='start'
        >
          {/* Left: identity card */}
          <EditUserIdentityCard user={user} />

          {/* Right: form sections */}
          <EditUserFormFields
            setError={setError}
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
            fetchRoles={fetchRoles}
            fetchGroups={fetchGroups}
          />
        </Grid>
      </Form>

      <Modal.ConfirmBack
        ref={confirmBackModalRef}
        onConfirm={handleConfirmBack}
      />
    </Box>
  );
}

// =============================================================================
// Form fields — inner component consumes react-hook-form context
// =============================================================================

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

  isDirtyRef.current = isDirty;

  const handleCancel = useCallback(() => {
    onCancel(isDirty);
  }, [onCancel, isDirty]);

  // ── Roles state ────────────────────────────────────────────────────
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadingMore, setRolesLoadingMore] = useState(false);
  const [rolesHasMore, setRolesHasMore] = useState(false);
  const [rolesPage, setRolesPage] = useState(1);
  const rolesLimit = 10;

  // ── Groups state ───────────────────────────────────────────────────
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsLoadingMore, setGroupsLoadingMore] = useState(false);
  const [groupsHasMore, setGroupsHasMore] = useState(false);
  const [groupsPage, setGroupsPage] = useState(1);
  const groupsLimit = 10;

  // ── Search state ───────────────────────────────────────────────────
  const [roleSearch, setRoleSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // ── Password generation ────────────────────────────────────────────
  const [generatingPassword, setGeneratingPassword] = useState(false);

  const selectedRoles = watch('roles') || [];
  const selectedGroups = watch('groups') || [];

  // ── Load roles ─────────────────────────────────────────────────────
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

  useDebounce(roleSearch, 300, debouncedSearch => {
    loadRoles(1, debouncedSearch, true);
  });

  const handleLoadMoreRoles = useCallback(() => {
    if (!rolesLoadingMore && rolesHasMore) {
      loadRoles(rolesPage + 1, roleSearch, false);
    }
  }, [rolesLoadingMore, rolesHasMore, rolesPage, roleSearch, loadRoles]);

  // ── Load groups ────────────────────────────────────────────────────
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
        // silently handle
      } finally {
        setGroupsLoading(false);
        setGroupsLoadingMore(false);
      }
    },
    [dispatch, fetchGroups],
  );

  useDebounce(groupSearch, 300, debouncedSearch => {
    loadGroups(1, debouncedSearch, true);
  });

  const handleLoadMoreGroups = useCallback(() => {
    if (!groupsLoadingMore && groupsHasMore) {
      loadGroups(groupsPage + 1, groupSearch, false);
    }
  }, [groupsLoadingMore, groupsHasMore, groupsPage, groupSearch, loadGroups]);

  // ── Password generation ────────────────────────────────────────────
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
      const message =
        (typeof err === 'string' ? err : err?.message) ||
        t('admin:users.errors.generatePassword', 'Failed to generate password');
      setError(message);
      dispatch(showErrorMessage({ message }));
    } finally {
      setGeneratingPassword(false);
    }
  }, [dispatch, setValue, setError, t]);

  return (
    <Card variant='surface' className='p-0'>
      {/* ── Account Information ──────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        style={{
          backgroundColor: 'var(--gray-a2)',
          borderBottom: '1px solid var(--gray-a4)',
        }}
      >
        <Text size='2' weight='bold' color='gray'>
          {t('admin:users.edit.accountInfo', 'Account Information')}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field
          name='email'
          label={t('admin:users.edit.email', 'Email')}
          className='mb-0'
        >
          <Form.Input type='email' disabled />
        </Form.Field>

        <Form.Field
          name='password'
          label={t('admin:users.edit.newPassword', 'New Password (optional)')}
          className='mt-4'
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
            type='button'
            variant='ghost'
            size='1'
            onClick={handleGeneratePassword}
            disabled={generatingPassword}
            className='inline-flex items-center gap-1'
            color='indigo'
          >
            <LockOpen1Icon width={13} height={13} />
            {generatingPassword
              ? t('admin:users.generatingPassword', 'Generating...')
              : t('admin:users.generateNewPassword', 'Generate New Password')}
          </Button>
        </Flex>
      </Box>

      {/* ── Personal Information ─────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        style={{
          backgroundColor: 'var(--gray-a2)',
          borderTop: '1px solid var(--gray-a4)',
          borderBottom: '1px solid var(--gray-a4)',
        }}
      >
        <Text size='2' weight='bold' color='gray'>
          {t('admin:users.edit.personalInfo', 'Personal Information')}
        </Text>
      </Box>
      <Box p='5'>
        <Grid columns={{ initial: '1', sm: '2' }} gap='4'>
          <Form.Field
            name='profile.first_name'
            label={t('admin:users.edit.firstName', 'First Name')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t('admin:users.edit.firstNamePlaceholder', 'John')}
            />
          </Form.Field>
          <Form.Field
            name='profile.last_name'
            label={t('admin:users.edit.lastName', 'Last Name')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t('admin:users.edit.lastNamePlaceholder', 'Doe')}
            />
          </Form.Field>
        </Grid>

        <Form.Field
          name='profile.display_name'
          label={t('admin:users.edit.displayName', 'Display Name')}
          className='mt-4'
        >
          <Form.Input
            placeholder={t(
              'admin:users.edit.displayNamePlaceholder',
              'John Doe',
            )}
          />
        </Form.Field>
      </Box>

      {/* ── Access & Permissions ─────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        style={{
          backgroundColor: 'var(--gray-a2)',
          borderTop: '1px solid var(--gray-a4)',
          borderBottom: '1px solid var(--gray-a4)',
        }}
      >
        <Text size='2' weight='bold' color='gray'>
          {t('admin:users.edit.accessAndPermissions', 'Access & Permissions')}
        </Text>
      </Box>
      <Box p='5'>
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
            emptyMessage={t(
              'admin:users.edit.noRolesFound',
              'No roles found',
            )}
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

        <Form.Field
          name='is_active'
          label={t('admin:users.edit.accountStatus', 'Account Status')}
        >
          <Form.Checkbox label={t('admin:users.edit.active', 'Active')} />
        </Form.Field>
      </Box>

      {/* ── Footer actions ───────────────────────────────────────── */}
      <Flex
        align='center'
        justify='between'
        px='5'
        py='4'
        className='rounded-b-md'
        style={{
          backgroundColor: 'var(--gray-2)',
          borderTop: '1px solid var(--gray-a4)',
        }}
      >
        <Button variant='soft' color='gray' type='button' onClick={handleCancel}>
          {t('admin:users.edit.cancel', 'Cancel')}
        </Button>
        <Button
          variant='solid'
          color='indigo'
          type='submit'
          loading={loading}
        >
          {loading
            ? t('admin:users.edit.saving', 'Saving...')
            : t('admin:users.edit.saveChanges', 'Save Changes')}
        </Button>
      </Flex>
    </Card>
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
