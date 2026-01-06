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
import { updateGroupFormSchema } from '../../../../shared/validator/features/admin';
import {
  updateGroup,
  fetchGroupById,
  fetchRoles,
  isGroupUpdateLoading,
  isGroupFetchLoading,
  isGroupFetchInitialized,
  getFetchedGroup,
  getGroupFetchError,
} from '../../../../redux';
import { useDebounce } from '../../../../components/InfiniteScroll';
import { Box, Icon, Loader, ConfirmModal } from '../../../../components/Admin';
import Button from '../../../../components/Button';
import Form, { useFormContext } from '../../../../components/Form';
import s from './EditGroup.css';

function EditGroup({ groupId }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const loading = useSelector(isGroupUpdateLoading);
  const fetchingGroup = useSelector(isGroupFetchLoading);
  const fetchInitialized = useSelector(isGroupFetchInitialized);
  const group = useSelector(getFetchedGroup);
  const groupLoadError = useSelector(getGroupFetchError);

  const [error, setError] = useState(null);
  const confirmBackModalRef = useRef(null);

  const handleCancel = useCallback(() => {
    confirmBackModalRef.current && confirmBackModalRef.current.open();
  }, []);

  const handleConfirmBack = useCallback(() => {
    history.push('/admin/groups');
  }, [history]);

  const handleSubmit = useCallback(
    async data => {
      setError(null);

      try {
        await dispatch(
          updateGroup({ groupId: group.id, groupData: data }),
        ).unwrap();
        history.push('/admin/groups');
      } catch (err) {
        setError(err || t('errors.updateGroup', 'Failed to update group'));
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
          title='Edit Group'
          subtitle='Modify group details'
        >
          <Button variant='secondary' onClick={handleCancel}>
            ← Back to Groups
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
          title='Edit Group'
          subtitle='Modify group details'
        >
          <Button variant='secondary' onClick={handleCancel}>
            ← Back to Groups
          </Button>
        </Box.Header>
        <div className={s.formContainer}>
          <div className={s.formError}>Failed to load group data</div>
          <div className={s.formActions}>
            <Button variant='secondary' onClick={handleCancel}>
              Back to Groups
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
        title='Edit Group'
        subtitle='Modify group details'
      >
        <Button variant='secondary' onClick={handleCancel}>
          ← Back to Groups
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
          <EditGroupFormFields handleCancel={handleCancel} loading={loading} />
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
function EditGroupFormFields({ handleCancel, loading }) {
  const dispatch = useDispatch();
  const { watch } = useFormContext();

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
        <h3 className={s.sectionTitle}>Group Information</h3>

        <Form.Field name='name' label='Group Name' required>
          <Form.Input placeholder='e.g., Engineering, Marketing, Support' />
        </Form.Field>

        <Form.Field name='description' label='Description'>
          <Form.Textarea
            placeholder='Describe what this group is for...'
            rows={3}
          />
        </Form.Field>

        <div className={s.formRow}>
          <Form.Field name='category' label='Category'>
            <Form.Input placeholder='e.g., System, Organization, Department' />
          </Form.Field>
          <Form.Field name='type' label='Type'>
            <Form.Input placeholder='e.g., Security, Organizational, Functional' />
          </Form.Field>
        </div>
      </div>

      <div className={s.formSection}>
        <h3 className={s.sectionTitle}>
          Roles ({selectedRoles.length} selected)
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
            searchPlaceholder='Search roles...'
            onSearch={setRoleSearch}
            emptyMessage='No roles found'
            loadingMessage='Loading roles...'
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

EditGroupFormFields.propTypes = {
  handleCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
};

EditGroup.propTypes = {
  groupId: PropTypes.string.isRequired,
};

export default EditGroup;
