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
import { useHistory } from '../../../../../../shared/renderer/components/History';
import {
  fetchPermissionById,
  updatePermission,
  isPermissionFetchLoading,
  isPermissionUpdateLoading,
  isPermissionFetchInitialized,
  getFetchedPermission,
  getPermissionFetchError,
} from '../../redux';
import {
  Box,
  Icon,
  ConfirmModal,
  Loader,
} from '../../../../../../shared/renderer/components/Admin';
import Button from '../../../../../../shared/renderer/components/Button';
import Form, {
  useFormContext,
} from '../../../../../../shared/renderer/components/Form';
import { updatePermissionFormSchema } from '../../../../validator/admin';
import s from './EditPermission.css';

export default function EditPermission({ permissionId }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isPermissionFetchLoading);
  const saving = useSelector(isPermissionUpdateLoading);
  const fetchInitialized = useSelector(isPermissionFetchInitialized);
  const permission = useSelector(getFetchedPermission);
  const permissionLoadError = useSelector(getPermissionFetchError);
  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  // Fetch permission data on mount
  useEffect(() => {
    if (permissionId) {
      dispatch(fetchPermissionById(permissionId));
    }
  }, [dispatch, permissionId]);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/permissions');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/permissions');
  }, [history]);

  const handleSubmit = useCallback(
    async data => {
      setError(null);

      try {
        await dispatch(
          updatePermission({ permissionId, permissionData: data }),
        ).unwrap();
        history.push('/admin/permissions');
      } catch (err) {
        setError(err);
      }
    },
    [dispatch, history, permissionId],
  );

  // Build default values from permission data (memoized)
  const defaultValues = useMemo(
    () =>
      permission
        ? {
            resource: permission.resource || '',
            action: permission.action || '',
            description: permission.description || '',
            is_active: permission.is_active !== false,
          }
        : {
            resource: '',
            action: '',
            description: '',
            is_active: true,
          },
    [permission],
  );

  // Show loading on first fetch or when still fetching
  if (!fetchInitialized || loading) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='key' size={24} />}
          title={t('admin:permissions.edit.title', 'Edit Permission')}
          subtitle={t(
            'admin:permissions.edit.subtitle',
            'Modify permission rule',
          )}
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            <Icon name='arrowLeft' />
            {t('admin:permissions.backToPermissions', 'Back to Permissions')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <Loader
            variant='spinner'
            message={t(
              'admin:permissions.edit.loadingPermission',
              'Loading permission...',
            )}
          />
        </div>
      </div>
    );
  }

  if (permissionLoadError) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='key' size={24} />}
          title={t('admin:permissions.edit.title', 'Edit Permission')}
          subtitle={t(
            'admin:permissions.edit.subtitle',
            'Modify permission rule',
          )}
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            <Icon name='arrowLeft' />
            {t('admin:permissions.backToPermissions', 'Back to Permissions')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>
            {t(
              'admin:permissions.edit.loadPermissionError',
              'Failed to load permission data',
            )}
          </div>
          <div className={s.formActions}>
            <Button
              variant='secondary'
              onClick={() => handleCancel(isDirtyRef.current)}
            >
              {t('admin:permissions.backToPermissions', 'Back to Permissions')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='key' size={24} />}
        title={t('admin:permissions.edit.title', 'Edit Permission')}
        subtitle={t(
          'admin:permissions.edit.subtitle',
          'Modify permission rule',
        )}
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <Icon name='arrowLeft' />
          {t('admin:permissions.backToPermissions', 'Back to Permissions')}
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <Form.Error message={error} />

        <Form
          schema={updatePermissionFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <EditPermissionFormFields
            onCancel={handleCancel}
            saving={saving}
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
 * EditPermissionFormFields - Form fields component that uses react-hook-form context
 */
function EditPermissionFormFields({ onCancel, saving, isDirtyRef }) {
  const { t } = useTranslation();
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

  // Watch for auto-generated name preview
  const resource = watch('resource') || '';
  const action = watch('action') || '';
  const generatedName = resource && action ? `${resource}:${action}` : '-';

  return (
    <>
      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t(
            'admin:permissions.edit.permissionInformation',
            'Permission Information',
          )}
        </h3>

        <div className={s.formRow}>
          <Form.Field
            name='resource'
            label={t('admin:permissions.edit.resource', 'Resource')}
            required
          >
            <Form.Input
              placeholder={t(
                'admin:permissions.edit.resourcePlaceholder',
                'e.g. users, posts, comments',
              )}
            />
          </Form.Field>
          <Form.Field
            name='action'
            label={t('admin:permissions.edit.action', 'Action')}
            required
          >
            <Form.Input
              placeholder={t(
                'admin:permissions.edit.actionPlaceholder',
                'e.g. read, write, delete',
              )}
            />
          </Form.Field>
        </div>

        <Form.Field
          name='description'
          label={t('admin:permissions.edit.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:permissions.edit.descriptionPlaceholder',
              'Describe what this permission allows...',
            )}
            rows={3}
          />
        </Form.Field>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:permissions.edit.status', 'Status')}
        </h3>

        <Form.Field name='is_active'>
          <Form.Checkbox label={t('admin:permissions.edit.active', 'Active')} />
        </Form.Field>
        <p className={s.checkboxHint}>
          {t(
            'admin:permissions.edit.inactivePermission',
            'Inactive permissions will not be enforced in authorization checks',
          )}
        </p>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:permissions.edit.generatedName', 'Generated Name')}
        </h3>
        <div className={s.previewName}>{generatedName}</div>
        <p className={s.previewHint}>
          {t(
            'admin:permissions.edit.generatedNameHint',
            'Permission name is auto-generated from resource and action',
          )}
        </p>
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel} disabled={saving}>
          {t('admin:permissions.edit.cancel', 'Cancel')}
        </Button>
        <Button variant='primary' type='submit' loading={saving}>
          {saving
            ? t('admin:permissions.edit.saving', 'Saving...')
            : t('admin:permissions.edit.saveChanges', 'Save Changes')}
        </Button>
      </div>
    </>
  );
}

EditPermissionFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

EditPermission.propTypes = {
  permissionId: PropTypes.string.isRequired,
};
