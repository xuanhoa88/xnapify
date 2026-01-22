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
import { createRoleFormSchema } from '../../../../../../shared/validator/features/admin';
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
import { fetchPermissions } from '../../permissions/redux';
import { createRole, isRoleCreateLoading } from '../redux';
import s from './CreateRole.css';

function CreateRole() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isRoleCreateLoading);

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
        await dispatch(createRole(data)).unwrap();
        history.push('/admin/roles');
      } catch (err) {
        setError(err || t('errors.createRole', 'Failed to create role'));
      }
    },
    [dispatch, history, t],
  );

  const defaultValues = {
    name: '',
    description: '',
    permissions: [],
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='shield' size={24} />}
        title='Create New Role'
        subtitle='Define a new access level'
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
          schema={createRoleFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <CreateRoleFormFields
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
 * CreateRoleFormFields - Form fields component that uses react-hook-form context
 */
function CreateRoleFormFields({ onCancel, loading, isDirtyRef }) {
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
          {loading ? 'Creating...' : 'Create Role'}
        </Button>
      </div>
    </>
  );
}

CreateRoleFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

export default CreateRole;
