/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import * as Box from '@shared/renderer/components/Box';
import Button from '@shared/renderer/components/Button';
import ConfirmModal from '@shared/renderer/components/ConfirmModal';
import Form, { useFormContext } from '@shared/renderer/components/Form';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll';
import Loader from '@shared/renderer/components/Loader';

import { updateRoleFormSchema } from '../../../../validator/admin';
import {
  updateRole,
  fetchRoleById,
  isRoleUpdateLoading,
  isRoleFetchLoading,
  isRoleFetchInitialized,
  getFetchedRole,
  getRoleFetchError,
} from '../../redux';

import s from './EditRole.css';

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

  const [error, setError] = useState(null);
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
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='shield' size={24} />}
          title={t('admin:roles.edit.editRole', 'Edit Role')}
          subtitle={t(
            'admin:roles.edit.modifyRolePermissions',
            'Modify role permissions',
          )}
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            <Icon name='arrowLeft' />
            {t('admin:buttons.backToRoles', 'Back to Roles')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <Loader
            variant='spinner'
            message={t('admin:roles.loadingRoleData', 'Loading role data...')}
          />
        </div>
        <ConfirmModal.Back
          ref={confirmBackModalRef}
          onConfirm={handleConfirmBack}
        />
      </div>
    );
  }

  if (!role || roleLoadError) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='shield' size={24} />}
          title={t('admin:roles.edit.editRole', 'Edit Role')}
          subtitle={t(
            'admin:roles.edit.modifyRolePermissions',
            'Modify role permissions',
          )}
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            <Icon name='arrowLeft' />
            {t('admin:buttons.backToRoles', 'Back to Roles')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>
            {t('admin:errors.failedToLoadRoleData', 'Failed to load role data')}
          </div>
          <div className={s.formActions}>
            <Button
              variant='secondary'
              onClick={() => handleCancel(isDirtyRef.current)}
            >
              {t('admin:buttons.backToRoles', 'Back to Roles')}
            </Button>
          </div>
        </div>
        <ConfirmModal.Back
          ref={confirmBackModalRef}
          onConfirm={handleConfirmBack}
        />
      </div>
    );
  }

  const defaultValues = {
    name: role.name || '',
    description: role.description || '',
    permissions:
      role.permissions && role.permissions.length > 0
        ? role.permissions.map(p => p.id)
        : [],
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='shield' size={24} />}
        title={t('admin:roles.edit.editRole', 'Edit Role')}
        subtitle={t(
          'admin:roles.edit.modifyRolePermissions',
          'Modify role permissions',
        )}
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <Icon name='arrowLeft' />
          {t('admin:buttons.backToRoles', 'Back to Roles')}
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <Form.Error message={error} />

        <Form
          schema={updateRoleFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <EditRoleFormFields
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
            fetchPermissions={fetchPermissions}
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
    <>
      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:roles.edit.roleInformation', 'Role Information')}
        </h3>

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
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t(
            'admin:roles.edit.permissionsCount',
            'Permissions ({{count}} selected)',
            {
              count: selectedPermissions.length,
            },
          )}
        </h3>

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
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel} disabled={loading}>
          {t('admin:buttons.cancel', 'Cancel')}
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading
            ? t('admin:buttons.saving', 'Saving...')
            : t('admin:buttons.saveChanges', 'Save Changes')}
        </Button>
      </div>
    </>
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
