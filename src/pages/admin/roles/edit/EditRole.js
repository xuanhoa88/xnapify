/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../../components/History';
import { updateRoleFormSchema } from '../../../../shared/validator/features/admin';
import {
  updateRole,
  fetchRoleById,
  fetchPermissions,
  isRoleUpdateLoading,
  isRoleFetchLoading,
  isRoleFetchInitialized,
  getFetchedRole,
  getRoleFetchError,
} from '../../../../redux';
import { useDebounce } from '../../../../components/InfiniteScroll';
import { Box, Icon, Loader, ConfirmModal } from '../../../../components/Admin';
import Button from '../../../../components/Button';
import Form, { useFormContext } from '../../../../components/Form';
import s from './EditRole.css';

function EditRole({ roleId }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
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
    async data => {
      setError(null);

      try {
        await dispatch(
          updateRole({ roleId: role.id, roleData: data }),
        ).unwrap();
        history.push('/admin/roles');
      } catch (err) {
        setError(err || t('errors.updateRole', 'Failed to update role'));
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
          title='Edit Role'
          subtitle='Modify role permissions'
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            ← Back to Roles
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <Loader variant='spinner' message='Loading role data...' />
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
          title='Edit Role'
          subtitle='Modify role permissions'
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            ← Back to Roles
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>Failed to load role data</div>
          <div className={s.formActions}>
            <Button
              variant='secondary'
              onClick={() => handleCancel(isDirtyRef.current)}
            >
              Back to Roles
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
        title='Edit Role'
        subtitle='Modify role permissions'
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          ← Back to Roles
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
function EditRoleFormFields({ onCancel, loading, isDirtyRef }) {
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
    [dispatch],
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
        <h3 className={s.sectionTitle}>Role Information</h3>

        <Form.Field name='name' label='Role Name' required>
          <Form.Input placeholder='e.g., editor, moderator, viewer' />
        </Form.Field>

        <Form.Field name='description' label='Description'>
          <Form.Textarea
            placeholder='Describe what this role is for...'
            rows={3}
          />
        </Form.Field>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          Permissions ({selectedPermissions.length} selected)
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
            searchPlaceholder='Search e.g. users, users:read, :create'
            onSearch={setPermissionSearch}
            emptyMessage='No permissions found'
            loadingMessage='Loading permissions...'
          />
        </Form.Field>
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </>
  );
}

EditRoleFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

EditRole.propTypes = {
  roleId: PropTypes.string.isRequired,
};

export default EditRole;
