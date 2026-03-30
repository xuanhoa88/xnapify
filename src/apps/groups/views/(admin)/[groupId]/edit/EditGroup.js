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

import { updateGroupFormSchema } from '../../../../validator/admin';
import {
  updateGroup,
  fetchGroupById,
  isGroupUpdateLoading,
  isGroupFetchLoading,
  isGroupFetchInitialized,
  getFetchedGroup,
  getGroupFetchError,
} from '../../redux';

import s from './EditGroup.css';

function EditGroup({ groupId, context }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const { container } = context;
  const { fetchRoles } = useMemo(() => {
    const { thunks } = container.resolve('roles:admin:state');
    return thunks;
  }, [container]);

  const history = useHistory();
  const loading = useSelector(isGroupUpdateLoading);
  const fetchingGroup = useSelector(isGroupFetchLoading);
  const fetchInitialized = useSelector(isGroupFetchInitialized);
  const group = useSelector(getFetchedGroup);
  const groupLoadError = useSelector(getGroupFetchError);

  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  const handleCancel = useCallback(
    isDirty => {
      if (isDirty) {
        confirmBackModalRef.current && confirmBackModalRef.current.open();
      } else {
        history.push('/admin/groups');
      }
    },
    [history],
  );

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/groups');
  }, [history]);

  const handleSubmit = useCallback(
    async (data, methods) => {
      setError(null);

      try {
        await dispatch(
          updateGroup({ groupId: group.id, groupData: data }),
        ).unwrap();
        history.push('/admin/groups');
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
            err || t('admin:errors.updateGroup', 'Failed to update group'),
          );
        }
      }
    },
    [dispatch, group, history, t],
  );

  // Fetch group data on mount
  useEffect(() => {
    if (groupId) {
      dispatch(fetchGroupById(groupId));
    }
  }, [dispatch, groupId]);

  // Show loading on first fetch or when still fetching
  if (!fetchInitialized || fetchingGroup) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='folder' size={24} />}
          title={t('admin:groups.edit.title', 'Edit Group')}
          subtitle={t('admin:groups.edit.subtitle', 'Modify group details')}
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            <Icon name='arrowLeft' />
            {t('admin:groups.backToGroups', 'Back to Groups')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <Loader variant='spinner' message='Loading group data...' />
        </div>
        <ConfirmModal.Back
          ref={confirmBackModalRef}
          onConfirm={handleConfirmBack}
        />
      </div>
    );
  }

  if (!group || groupLoadError) {
    return (
      <div className={s.root}>
        <Box.Header
          icon={<Icon name='folder' size={24} />}
          title={t('admin:groups.edit.title', 'Edit Group')}
          subtitle={t('admin:groups.edit.subtitle', 'Modify group details')}
        >
          <Button
            variant='secondary'
            onClick={() => handleCancel(isDirtyRef.current)}
          >
            <Icon name='arrowLeft' />
            {t('admin:groups.backToGroups', 'Back to Groups')}
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>
            {t(
              'admin:errors.failedToLoadGroupData',
              'Failed to load group data',
            )}
          </div>
          <div className={s.formActions}>
            <Button
              variant='secondary'
              onClick={() => handleCancel(isDirtyRef.current)}
            >
              {t('admin:groups.backToGroups', 'Back to Groups')}
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
    name: group.name || '',
    description: group.description || '',
    category: group.category || '',
    type: group.type || '',
    roles:
      Array.isArray(group.roles) && group.roles.length > 0 ? group.roles : [],
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='folder' size={24} />}
        title={t('admin:groups.edit.title', 'Edit Group')}
        subtitle={t('admin:groups.edit.subtitle', 'Modify group details')}
      >
        <Button
          variant='secondary'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <Icon name='arrowLeft' />
          {t('admin:groups.backToGroups', 'Back to Groups')}
        </Button>
      </Box.Header>

      <div className={s.formContainer}>
        <Form.Error message={error} />

        <Form
          schema={updateGroupFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <EditGroupFormFields
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
            fetchRoles={fetchRoles}
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
 * EditGroupFormFields - Form fields component that uses react-hook-form context
 */
function EditGroupFormFields({ onCancel, loading, isDirtyRef, fetchRoles }) {
  const dispatch = useDispatch();
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

  // Watch selected roles count
  const selectedRoles = watch('roles') || [];

  // Roles state for loading
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesHasMore, setRolesHasMore] = useState(false);
  const [rolesPage, setRolesPage] = useState(1);
  const rolesLimit = 20;

  // Role search state
  const [roleSearch, setRoleSearch] = useState('');

  // Fetch roles with pagination
  const loadRoles = useCallback(
    async (page, search = '', reset = false) => {
      if (reset) {
        setRolesLoading(true);
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
      }
    },
    [dispatch, fetchRoles],
  );

  // Debounced role search (also handles initial load on mount)
  useDebounce(roleSearch, 300, debouncedSearch => {
    loadRoles(1, debouncedSearch, true);
  });

  // Load more roles handler
  const handleLoadMoreRoles = useCallback(() => {
    if (!rolesLoading && rolesHasMore) {
      loadRoles(rolesPage + 1, roleSearch, false);
    }
  }, [rolesLoading, rolesHasMore, rolesPage, roleSearch, loadRoles]);

  return (
    <>
      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:groups.edit.groupInformation', 'Group Information')}
        </h3>

        <Form.Field
          name='name'
          label={t('admin:groups.edit.groupName', 'Group Name')}
          required
        >
          <Form.Input
            placeholder={t(
              'admin:groups.edit.groupNamePlaceholder',
              'e.g., Engineering, Marketing, Support',
            )}
          />
        </Form.Field>

        <Form.Field
          name='description'
          label={t('admin:groups.edit.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:groups.edit.descriptionPlaceholder',
              'Describe what this group is for...',
            )}
            rows={3}
          />
        </Form.Field>

        <div className={s.formRow}>
          <Form.Field
            name='category'
            label={t('admin:groups.edit.category', 'Category')}
          >
            <Form.Input
              placeholder={t(
                'admin:groups.edit.categoryPlaceholder',
                'e.g., System, Organization, Department',
              )}
            />
          </Form.Field>
          <Form.Field name='type' label={t('admin:groups.edit.type', 'Type')}>
            <Form.Input
              placeholder={t(
                'admin:groups.edit.typePlaceholder',
                'e.g., Security, Organizational, Functional',
              )}
            />
          </Form.Field>
        </div>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:groups.edit.rolesCount', 'Roles ({{count}} selected)', {
            count: selectedRoles.length,
          })}
        </h3>

        <Form.Field name='roles'>
          <Form.CheckboxList
            items={roles}
            valueKey='name'
            labelKey='name'
            descriptionKey='description'
            loading={rolesLoading}
            hasMore={rolesHasMore}
            onLoadMore={handleLoadMoreRoles}
            searchable
            searchPlaceholder={t(
              'admin:groups.edit.searchRoles',
              'Search roles...',
            )}
            onSearch={setRoleSearch}
            emptyMessage={t('admin:groups.edit.noRolesFound', 'No roles found')}
            loadingMessage={t(
              'admin:groups.edit.loadingRoles',
              'Loading roles...',
            )}
          />
        </Form.Field>
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel} disabled={loading}>
          {t('admin:groups.edit.cancel', 'Cancel')}
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading
            ? t('admin:groups.edit.saving', 'Saving...')
            : t('admin:groups.edit.saveChanges', 'Save Changes')}
        </Button>
      </div>
    </>
  );
}

EditGroupFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
  fetchRoles: PropTypes.func.isRequired,
};

EditGroup.propTypes = {
  groupId: PropTypes.string.isRequired,
  context: PropTypes.shape({ container: PropTypes.object }).isRequired,
};

export default EditGroup;
