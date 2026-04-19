/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { LockClosedIcon } from '@radix-ui/react-icons';
import { Box, Flex, Heading, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import Modal from '@shared/renderer/components/Modal';

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

import s from './EditRole.css';

/**
 * EditRole implementing explicit pure layout variables avoiding relative mappings smartly functionally effectively securely elegantly simply exclusively statically beautifully efficiently cleanly.
 */
function EditRole({ roleId, context }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const { container } = context;
  const { fetchPermissions } = useMemo(() => {
    const { thunks } = container.resolve('permissions:admin:state');
    return thunks;
  }, [container]);

  const defaultValues = useMemo(
    () => ({
      name: role.name || '',
      description: role.description || '',
      permissions:
        role.permissions && role.permissions.length > 0
          ? role.permissions.map(p => p.id)
          : [],
    }),
    [role],
  );

  const history = useHistory();
  const loading = useSelector(isRoleUpdateLoading);
  const fetchingRole = useSelector(isRoleFetchLoading);
  const fetchInitialized = useSelector(isRoleFetchInitialized);
  const role = useSelector(getFetchedRole);
  const roleLoadError = useSelector(getRoleFetchError);

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

  // Fetch role data on mount
  useEffect(() => {
    if (roleId) {
      dispatch(fetchRoleById(roleId));
    }
  }, [dispatch, roleId]);

  // Show loading on first fetch or when still fetching
  if (!fetchInitialized || fetchingRole) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className={s.headerFlex}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.headerIconBox}>
              <LockClosedIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.headerHeading}>
                {null}
              </Heading>
            </Flex>
          </Flex>
        </Flex>
        <Modal.ConfirmBack
          ref={confirmBackModalRef}
          onConfirm={handleConfirmBack}
        />
      </Box>
    );
  }

  if (!role || roleLoadError) {
    return (
      <Box className={s.containerBox}>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className={s.headerFlex}
        >
          <Flex align='center' gap='3'>
            <Flex align='center' justify='center' className={s.headerIconBox}>
              <LockClosedIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6' className={s.headerHeading}>
                {null}
              </Heading>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className={s.containerBox}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        className={s.headerFlex}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.headerIconBox}>
            <LockClosedIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6' className={s.headerHeading}>
              {null}
            </Heading>
          </Flex>
        </Flex>
      </Flex>

      <Form
        schema={updateRoleFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <EditRoleFormFields
          onCancel={handleCancel}
          loading={loading}
          isDirtyRef={isDirtyRef}
          fetchPermissions={fetchPermissions}
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
 * EditRoleFormFields - Form fields component that uses react-hook-form context
 */
function EditRoleFormFields({
  onCancel,
  loading,
  isDirtyRef,
  fetchPermissions,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const {
    watch,
    formState: { isDirty },
  } = useFormContext();

  // Keep isDirtyRef in sync with form dirty state
  isDirtyRef.current = isDirty;

  // Wrap onCancel to check dirty state
  const handleCancel = useCallback(() => {
    onCancel(isDirty);
  }, [onCancel, isDirty]);

  // Watch selected permissions count
  const selectedPermissions = watch('permissions') || [];

  // Permissions state for loading
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsHasMore, setPermissionsHasMore] = useState(false);
  const [permissionsPage, setPermissionsPage] = useState(1);
  const permissionsLimit = 20;

  // Permission search state
  const [permissionSearch, setPermissionSearch] = useState('');

  // Fetch permissions with pagination
  const loadPermissions = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setPermissionsLoading(true);
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
      }
    },
    [dispatch, fetchPermissions],
  );

  // Debounced permission search (also handles initial load on mount)
  useDebounce(permissionSearch, 300, debouncedSearch => {
    loadPermissions(1, debouncedSearch, true);
  });

  // Load more permissions handler
  const handleLoadMorePermissions = useCallback(() => {
    if (!permissionsLoading && permissionsHasMore) {
      loadPermissions(permissionsPage + 1, permissionSearch, false);
    }
  }, [
    permissionsLoading,
    permissionsHasMore,
    permissionsPage,
    permissionSearch,
    loadPermissions,
  ]);

  return (
    <Flex direction='column' gap='6'>
      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t('admin:roles.edit.roleInformation', 'Role Information')}
        </Heading>

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

      <Box>
        <Heading as='h3' size='4' className={s.sectionHeading}>
          {t(
            'admin:roles.edit.permissionsCount',
            'Permissions ({{count}} selected)',
            {
              count: selectedPermissions.length,
            },
          )}
        </Heading>

        <Form.Field name='permissions'>
          <Form.CheckboxList
            items={permissions}
            valueKey='id'
            labelKey='description'
            groupBy='resource'
            loading={permissionsLoading}
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

      <Flex gap='3' justify='end' className={s.actionsFlex}>
        <Button
          variant='soft'
          color='gray'
          onClick={handleCancel}
          disabled={loading}
        >
          {t('admin:buttons.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          {loading
            ? t('admin:buttons.saving', 'Saving...')
            : t('admin:buttons.saveChanges', 'Save Changes')}
        </Button>
      </Flex>
    </Flex>
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
