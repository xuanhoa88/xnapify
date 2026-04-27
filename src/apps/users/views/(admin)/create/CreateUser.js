/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useMemo } from 'react';

import { PersonIcon, LockOpen1Icon, PlusIcon } from '@radix-ui/react-icons';
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
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import Modal from '@shared/renderer/components/Modal';
import { PageHeader } from '@shared/renderer/components/PageHeader';
import { features } from '@shared/renderer/redux';

import { createUserFormSchema } from '../../../validator/admin';
import { createUser, isUserCreateLoading } from '../redux';

const { generatePassword, showSuccessMessage, showErrorMessage } = features;

// =============================================================================
// Identity sidebar card for the "Create" flow (no existing user data yet)
// =============================================================================

function CreateUserIdentityCard() {
  const { t } = useTranslation();
  const { watch } = useFormContext();

  const email = watch('email') || '';
  const displayName = watch('profile.display_name') || '';
  const firstName = watch('profile.first_name') || '';
  const lastName = watch('profile.last_name') || '';
  const isActive = watch('is_active');

  const resolvedName =
    displayName || [firstName, lastName].filter(Boolean).join(' ') || email;

  const fallback = resolvedName ? resolvedName.charAt(0).toUpperCase() : '?';

  return (
    <Card variant='surface'>
      <Flex direction='column' align='center' p='5' gap='4'>
        <Avatar
          size='6'
          name={resolvedName}
          fallback={fallback}
          radius='full'
          color='indigo'
        />

        <Flex direction='column' align='center' gap='1' className='w-full'>
          <Text size='4' weight='bold' align='center' className='break-all'>
            {resolvedName || t('admin:users.create.newUser', 'New User')}
          </Text>
          {email && resolvedName !== email && (
            <Text size='2' color='gray' align='center' className='break-all'>
              {email}
            </Text>
          )}
        </Flex>

        <Separator size='4' />

        <Flex direction='column' gap='3' className='w-full'>
          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:users.create.status', 'Status')}
            </Text>
            <Badge
              color={isActive ? 'green' : 'gray'}
              variant='soft'
              radius='full'
              size='1'
            >
              {isActive
                ? t('admin:users.create.active', 'Active')
                : t('admin:users.create.inactive', 'Inactive')}
            </Badge>
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:users.create.type', 'Type')}
            </Text>
            <Badge color='indigo' variant='soft' radius='full' size='1'>
              {t('admin:users.create.newAccount', 'New Account')}
            </Badge>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

// =============================================================================
// Main CreateUser component
// =============================================================================

function CreateUser({ context }) {
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
  const loading = useSelector(isUserCreateLoading);

  const [, setError] = useState(null);
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
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(createUser(data)).unwrap();
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
            (typeof err === 'string' ? err : err && err.message) ||
            t('admin:users.errors.createUser', 'Failed to create user');
          setError(message);
          dispatch(showErrorMessage({ message }));
        }
      }
    },
    [dispatch, history, t],
  );

  const defaultValues = {
    email: '',
    password: '',
    confirm_password: '',
    profile: {
      display_name: '',
      first_name: '',
      last_name: '',
    },
    roles: [],
    groups: [],
    is_active: true,
  };

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <PageHeader
        title={t('admin:users.create.title', 'Create New User')}
        subtitle={t(
          'admin:users.create.subtitle',
          'Add a new user and configure their access permissions',
        )}
        icon={<PersonIcon width={24} height={24} />}
      >
        <Button
          variant='ghost'
          color='gray'
          onClick={() => history.push('/admin/users')}
        >
          {t('admin:users.create.backToList', 'Back to Users')}
        </Button>
      </PageHeader>

      <Form
        schema={createUserFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <Grid columns={{ initial: '1', lg: '280px 1fr' }} gap='6' align='start'>
          {/* Left: live identity card */}
          <CreateUserIdentityCard />

          {/* Right: form sections */}
          <CreateUserFormFields
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

function CreateUserFormFields({
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
      } catch (err) {
        // silently handle
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
      setValue('confirm_password', password, { shouldValidate: true });
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
        (typeof err === 'string' ? err : err && err.message) ||
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
          {t('admin:users.create.accountInfo', 'Account Information')}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field
          name='email'
          label={t('admin:users.create.email', 'Email')}
          required
        >
          <Form.Input
            type='email'
            placeholder={t(
              'admin:users.create.emailPlaceholder',
              'user@example.com',
            )}
          />
        </Form.Field>

        <Form.Field
          name='password'
          label={t('admin:users.create.password', 'Password')}
          required
        >
          <Form.Password
            placeholder={t(
              'admin:users.create.passwordPlaceholder',
              'Enter password',
            )}
          />
        </Form.Field>

        <Form.Field
          name='confirm_password'
          label={t('admin:users.create.confirmPassword', 'Confirm Password')}
          required
        >
          <Form.Password
            placeholder={t(
              'admin:users.create.confirmPasswordPlaceholder',
              'Confirm password',
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
              : t(
                  'admin:users.generateSecurePassword',
                  'Generate Secure Password',
                )}
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
          {t('admin:users.create.personalInfo', 'Personal Information')}
        </Text>
      </Box>
      <Box p='5'>
        <Grid columns={{ initial: '1', sm: '2' }} gap='4'>
          <Form.Field
            name='profile.first_name'
            label={t('admin:users.create.firstName', 'First Name')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t('admin:users.create.firstNamePlaceholder', 'John')}
            />
          </Form.Field>
          <Form.Field
            name='profile.last_name'
            label={t('admin:users.create.lastName', 'Last Name')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t('admin:users.create.lastNamePlaceholder', 'Doe')}
            />
          </Form.Field>
        </Grid>

        <Form.Field
          name='profile.display_name'
          label={t('admin:users.create.displayName', 'Display Name')}
          className='mt-4'
        >
          <Form.Input
            placeholder={t(
              'admin:users.create.displayNamePlaceholder',
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
          {t('admin:users.create.accessAndPermissions', 'Access & Permissions')}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field
          name='roles'
          label={t(
            'admin:users.create.rolesSelected',
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
              'admin:users.create.searchRoles',
              'Search roles...',
            )}
            valueKey='name'
            labelKey='name'
            itemDescription='description'
            emptyMessage={t(
              'admin:users.create.noRolesFound',
              'No roles found',
            )}
            loadingMessage={t(
              'admin:users.create.loadingRoles',
              'Loading roles...',
            )}
          />
        </Form.Field>

        <Form.Field
          name='groups'
          label={t(
            'admin:users.create.groupsSelected',
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
              'admin:users.create.searchGroups',
              'Search groups...',
            )}
            valueKey='id'
            labelKey='name'
            itemDescription='description'
            emptyMessage={t(
              'admin:users.create.noGroupsFound',
              'No groups found',
            )}
            loadingMessage={t(
              'admin:users.create.loadingGroups',
              'Loading groups...',
            )}
          />
        </Form.Field>

        <Form.Field
          name='is_active'
          label={t('admin:users.create.accountStatus', 'Account Status')}
        >
          <Form.Checkbox label={t('admin:users.create.active', 'Active')} />
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
        <Button
          variant='soft'
          color='gray'
          type='button'
          onClick={handleCancel}
        >
          {t('admin:users.create.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          <PlusIcon width={15} height={15} />
          {loading
            ? t('admin:users.create.creating', 'Creating...')
            : t('admin:users.create.submit', 'Create User')}
        </Button>
      </Flex>
    </Card>
  );
}

CreateUserFormFields.propTypes = {
  setError: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
  fetchRoles: PropTypes.func.isRequired,
  fetchGroups: PropTypes.func.isRequired,
};

CreateUser.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default CreateUser;
