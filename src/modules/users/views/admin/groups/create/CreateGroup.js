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
import { createGroupFormSchema } from '../../../../validator/admin';
import { fetchRoles } from '../../roles/redux';
import { createGroup, isGroupCreateLoading } from '../redux';
import s from './CreateGroup.css';

function CreateGroup() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isGroupCreateLoading);

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
    async data => {
      setError(null);

      try {
        await dispatch(createGroup(data)).unwrap();
        history.push('/admin/groups');
      } catch (err) {
        setError(
          err || t('admin:errors.createGroup', 'Failed to create group'),
        );
      }
    },
    [dispatch, history, t],
  );

  const defaultValues = {
    name: '',
    description: '',
    category: '',
    type: '',
    roles: [],
  };

  return (
    <div className={s.root}>
      <Box.Header
        icon={<Icon name='folder' size={24} />}
        title={t('admin:groups.create.title', 'Create New Group')}
        subtitle={t(
          'admin:groups.create.subtitle',
          'Organize users into a new group',
        )}
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
          schema={createGroupFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className={s.form}
        >
          <CreateGroupFormFields
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
 * CreateGroupFormFields - Form fields component that uses react-hook-form context
 */
function CreateGroupFormFields({ onCancel, loading, isDirtyRef }) {
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
    [dispatch],
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
          {t('admin:groups.create.groupInformation', 'Group Information')}
        </h3>

        <Form.Field
          name='name'
          label={t('admin:groups.create.name', 'Group Name')}
          required
        >
          <Form.Input
            placeholder={t(
              'admin:groups.create.namePlaceholder',
              'e.g., Engineering, Marketing, Support',
            )}
          />
        </Form.Field>

        <Form.Field
          name='description'
          label={t('admin:groups.create.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'admin:groups.create.descriptionPlaceholder',
              'Describe what this group is for...',
            )}
            rows={3}
          />
        </Form.Field>

        <div className={s.formRow}>
          <Form.Field
            name='category'
            label={t('admin:groups.create.category', 'Category')}
          >
            <Form.Input
              placeholder={t(
                'admin:groups.create.categoryPlaceholder',
                'e.g., System, Organization, Department',
              )}
            />
          </Form.Field>
          <Form.Field name='type' label={t('admin:groups.create.type', 'Type')}>
            <Form.Input
              placeholder={t(
                'admin:groups.create.typePlaceholder',
                'e.g., Security, Organizational, Functional',
              )}
            />
          </Form.Field>
        </div>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          {t('admin:groups.create.rolesCount', 'Roles ({{count}} selected)', {
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
              'admin:groups.create.searchRoles',
              'Search roles...',
            )}
            onSearch={setRoleSearch}
            emptyMessage={t('admin:groups.create.emptyRoles', 'No roles found')}
            loadingMessage={t(
              'admin:groups.create.loadingRoles',
              'Loading roles...',
            )}
          />
        </Form.Field>
      </div>

      <div className={s.formActions}>
        <Button variant='secondary' onClick={handleCancel} disabled={loading}>
          {t('admin:groups.create.cancel', 'Cancel')}
        </Button>
        <Button variant='primary' type='submit' loading={loading}>
          {loading
            ? t('admin:groups.create.creating', 'Creating...')
            : t('admin:groups.create.createGroup', 'Create Group')}
        </Button>
      </div>
    </>
  );
}

CreateGroupFormFields.propTypes = {
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDirtyRef: PropTypes.shape({ current: PropTypes.bool }).isRequired,
};

export default CreateGroup;
