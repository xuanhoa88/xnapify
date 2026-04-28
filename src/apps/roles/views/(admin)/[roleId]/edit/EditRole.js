/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { LockClosedIcon, Pencil1Icon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Grid,
  Button,
  Card,
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

import { updateRoleFormSchema } from '../../../../validator/admin';
import {
  updateRole,
  fetchRoleById,
  isRoleUpdateLoading,
  isRoleFetchLoading,
  getRoleFetchError,
  isRoleFetchInitialized,
  getFetchedRole,
} from '../../redux';

// =============================================================================
// Identity sidebar card — reflects live form values
// =============================================================================

function EditRoleIdentityCard({ role }) {
  const { t } = useTranslation();
  const { watch } = useFormContext();

  const name = watch('name') || (role && role.name) || '';
  const selectedPermissions = watch('permissions') || [];

  return (
    <Card variant='surface'>
      <Flex direction='column' align='center' p='5' gap='4'>
        <Flex
          align='center'
          justify='center'
          width='64px'
          height='64px'
          className='rounded-full bg-[var(--indigo-3)] text-[var(--indigo-11)]'
        >
          <LockClosedIcon width={28} height={28} />
        </Flex>

        <Flex direction='column' align='center' gap='1' className='w-full'>
          <Text size='4' weight='bold' align='center' className='break-all'>
            {name || t('admin:roles.edit.unnamedRole', 'Unnamed Role')}
          </Text>
        </Flex>

        <Separator size='4' />

        <Flex direction='column' gap='3' className='w-full'>
          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:roles.edit.permissionsLabel', 'Permissions')}
            </Text>
            <Badge color='indigo' variant='soft' radius='full' size='1'>
              {selectedPermissions.length}
            </Badge>
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('admin:roles.edit.statusLabel', 'Status')}
            </Text>
            <Badge color='green' variant='soft' radius='full' size='1'>
              {t('admin:roles.edit.active', 'Active')}
            </Badge>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

EditRoleIdentityCard.propTypes = {
  role: PropTypes.object,
};

// =============================================================================
// Main EditRole component
// =============================================================================

function EditRole({ roleId, context }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const { container } = context;
  const { fetchPermissions } = useMemo(() => {
    const { thunks } = container.resolve('permissions:admin:state');
    return thunks;
  }, [container]);

  const history = useHistory();
  const loading = useSelector(isRoleUpdateLoading);
  const fetchingRole = useSelector(isRoleFetchLoading);
  const fetchInitialized = useSelector(isRoleFetchInitialized);
  const role = useSelector(getFetchedRole);
  const roleLoadError = useSelector(getRoleFetchError);

  const defaultValues = useMemo(
    () => ({
      name: role && role.name ? role.name : '',
      description: role && role.description ? role.description : '',
      permissions:
        role && role.permissions && role.permissions.length > 0
          ? role.permissions.map(p => p.id)
          : [],
    }),
    [role],
  );

  const [, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/roles');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/roles');
  }, [history]);

  const handleSubmit = useCallback(
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(
          updateRole({ roleId: role.id, roleData: data }),
        ).unwrap();
        history.push('/admin/roles');
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
          setError(
            err || t('admin:errors.updateRole', 'Failed to update role'),
          );
        }
      }
    },
    [dispatch, role, history, t],
  );

  useEffect(() => {
    if (roleId) {
      dispatch(fetchRoleById(roleId));
    }
  }, [dispatch, roleId]);

  const pageTitle =
    !fetchInitialized || fetchingRole
      ? t('admin:roles.edit.titleLoading', 'Loading Role...')
      : roleLoadError || !role
        ? t('admin:roles.edit.titleError', 'Error Loading Role')
        : t('admin:roles.edit.title', 'Edit Role: {{name}}', {
            name: role.name,
          });

  if (!fetchInitialized || fetchingRole || !role || roleLoadError) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <PageHeader
          title={pageTitle}
          icon={<LockClosedIcon width={24} height={24} />}
        >
          <Button
            variant='ghost'
            color='gray'
            onClick={() => history.push('/admin/roles')}
          >
            {t('admin:roles.edit.backToList', 'Back to Roles')}
          </Button>
        </PageHeader>
        <Modal.ConfirmBack
          ref={confirmBackModalRef}
          onConfirm={handleConfirmBack}
        />
      </Box>
    );
  }

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <PageHeader
        title={pageTitle}
        subtitle={t(
          'admin:roles.edit.subtitle',
          'Update role details and permission assignments',
        )}
        icon={<LockClosedIcon width={24} height={24} />}
      >
        <Button
          variant='ghost'
          color='gray'
          onClick={() => history.push('/admin/roles')}
        >
          {t('admin:roles.edit.backToList', 'Back to Roles')}
        </Button>
      </PageHeader>

      <Form
        schema={updateRoleFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <Grid columns={{ initial: '1', lg: '280px 1fr' }} gap='6' align='start'>
          {/* Left: live identity card */}
          <EditRoleIdentityCard role={role} />

          {/* Right: form sections */}
          <EditRoleFormFields
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
            fetchPermissions={fetchPermissions}
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

function EditRoleFormFields({
  onCancel,
  loading,
  isDirtyRef,
  fetchPermissions,
}) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const {
    watch,
    formState: { isDirty },
  } = useFormContext();

  isDirtyRef.current = isDirty;

  const handleCancel = useCallback(() => {
    onCancel(isDirty);
  }, [onCancel, isDirty]);

  const selectedPermissions = watch('permissions') || [];

  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsLoadingMore, setPermissionsLoadingMore] = useState(false);
  const [permissionsHasMore, setPermissionsHasMore] = useState(false);
  const [permissionsPage, setPermissionsPage] = useState(1);
  const permissionsLimit = 20;

  const [permissionSearch, setPermissionSearch] = useState('');

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
        // Silently handle error
      } finally {
        setPermissionsLoading(false);
        setPermissionsLoadingMore(false);
      }
    },
    [dispatch, fetchPermissions],
  );

  useDebounce(permissionSearch, 300, debouncedSearch => {
    loadPermissions(1, debouncedSearch, true);
  });

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

  return (
    <Card variant='surface' className='p-0'>
      {/* ── Role Information ──────────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        className='bg-[var(--gray-a2)] border-b border-[var(--gray-a4)]'
      >
        <Text size='2' weight='bold' color='gray'>
          {t('admin:roles.edit.roleInformation', 'Role Information')}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field
          name='name'
          label={t('admin:roles.edit.roleName', 'Role Name')}
          required
        >
          <Form.Input
            placeholder={t(
              'admin:roles.edit.roleNamePlaceholder',
              'e.g., editor, moderator, viewer',
            )}
          />
        </Form.Field>

        <Form.Field
          name='description'
          label={t('admin:roles.edit.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:roles.edit.descriptionPlaceholder',
              'Describe what this role is for...',
            )}
            rows={3}
          />
        </Form.Field>
      </Box>

      {/* ── Permissions ───────────────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        className='bg-[var(--gray-a2)] border-t border-[var(--gray-a4)] border-b border-[var(--gray-a4)]'
      >
        <Text size='2' weight='bold' color='gray'>
          {t(
            'admin:roles.edit.permissionsCount',
            'Permissions ({{count}} selected)',
            {
              count: selectedPermissions.length,
            },
          )}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field name='permissions'>
          <Form.CheckboxList
            items={permissions}
            valueKey='id'
            labelKey='description'
            groupBy='resource'
            loading={permissionsLoading}
            loadingMore={permissionsLoadingMore}
            hasMore={permissionsHasMore}
            onLoadMore={handleLoadMorePermissions}
            searchable
            searchPlaceholder={t(
              'admin:roles.edit.permissionsSearchPlaceholder',
              'Search e.g. users, users:read, :create',
            )}
            onSearch={setPermissionSearch}
            emptyMessage={t(
              'admin:roles.edit.permissionsEmptyMessage',
              'No permissions found',
            )}
            loadingMessage={t(
              'admin:roles.edit.permissionsLoadingMessage',
              'Loading permissions...',
            )}
          />
        </Form.Field>
      </Box>

      {/* ── Footer actions ────────────────────────────────────────── */}
      <Flex
        align='center'
        justify='between'
        px='5'
        py='4'
        className='rounded-b-md bg-[var(--gray-2)] border-t border-[var(--gray-a4)]'
      >
        <Button
          variant='soft'
          color='gray'
          type='button'
          onClick={handleCancel}
          disabled={loading}
        >
          {t('admin:buttons.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          <Pencil1Icon width={15} height={15} />
          {loading
            ? t('admin:buttons.saving', 'Saving...')
            : t('admin:buttons.saveChanges', 'Save Changes')}
        </Button>
      </Flex>
    </Card>
  );
}

EditRoleFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
  fetchPermissions: PropTypes.func.isRequired,
};

EditRole.propTypes = {
  roleId: PropTypes.string.isRequired,
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }),
};

export default EditRole;
