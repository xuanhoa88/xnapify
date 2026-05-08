/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { ArrowLeftIcon, GroupIcon } from '@radix-ui/react-icons';
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

import Form, {
  useFormContext,
} from '@shared/renderer/components/Form/index.js';
import { useHistory } from '@shared/renderer/components/History/index.js';
import { useDebounce } from '@shared/renderer/components/InfiniteScroll/index.js';
import Loader from '@shared/renderer/components/Loader/index.js';
import Modal from '@shared/renderer/components/Modal/index.js';
import { PageHeader } from '@shared/renderer/components/PageHeader/index.js';
import { features } from '@shared/renderer/redux/index.js';

import { updateGroupFormSchema } from '../../../../validator/admin/index.js';
import {
  updateGroup,
  fetchGroupById,
  isGroupUpdateLoading,
  isGroupFetchLoading,
  isGroupFetchInitialized,
  getFetchedGroup,
  getGroupFetchError,
} from '../../redux/index.js';

const { showErrorMessage } = features;

// =============================================================================
// Identity sidebar card — shows existing group metadata
// =============================================================================

function EditGroupIdentityCard({ group }) {
  const { t } = useTranslation();

  const fallback = group.name ? group.name.charAt(0).toUpperCase() : '?';

  return (
    <Card variant='surface'>
      <Flex direction='column' align='center' p='5' gap='4'>
        <Avatar
          size='6'
          name={group.name}
          fallback={fallback}
          radius='full'
          color='blue'
        />

        <Flex direction='column' align='center' gap='1' className='w-full'>
          <Text size='4' weight='bold' align='center' className='break-all'>
            {group.name}
          </Text>
        </Flex>

        <Separator size='4' />

        <Flex direction='column' gap='3' className='w-full'>
          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('groups:admin.edit.categoryLabel', 'Category')}
            </Text>
            {group.category ? (
              <Badge color='blue' variant='soft' radius='full' size='1'>
                {group.category}
              </Badge>
            ) : (
              <Text size='2' color='gray'>
                —
              </Text>
            )}
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('groups:admin.edit.typeLabel', 'Type')}
            </Text>
            {group.type ? (
              <Badge color='gray' variant='surface' radius='full' size='1'>
                {group.type}
              </Badge>
            ) : (
              <Text size='2' color='gray'>
                —
              </Text>
            )}
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('groups:admin.edit.usersCountLabel', 'Users')}
            </Text>
            <Badge color='indigo' variant='soft' radius='full' size='1'>
              {group.userCount || 0}
            </Badge>
          </Flex>

          <Flex justify='between' align='center'>
            <Text size='2' color='gray'>
              {t('groups:admin.edit.rolesCountLabel', 'Roles')}
            </Text>
            <Badge color='gray' variant='soft' radius='full' size='1'>
              {group.roleCount || (group.roles && group.roles.length) || 0}
            </Badge>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

EditGroupIdentityCard.propTypes = {
  group: PropTypes.shape({
    name: PropTypes.string,
    category: PropTypes.string,
    type: PropTypes.string,
    userCount: PropTypes.number,
    roleCount: PropTypes.number,
    roles: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
};

// =============================================================================
// Main EditGroup component
// =============================================================================

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

  const [, setError] = useState(null);
  const confirmBackModalRef = useRef(null);
  const isDirtyRef = useRef(false);

  // Fetch group data on mount
  useEffect(() => {
    if (groupId) {
      dispatch(fetchGroupById(groupId));
    }
  }, [dispatch, groupId]);

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
          const message =
            (typeof err === 'string' ? err : err && err.message) ||
            t('admin:errors.updateGroup', 'Failed to update group');
          setError(message);
          dispatch(showErrorMessage({ message }));
        }
      }
    },
    [dispatch, group, history, t],
  );

  const defaultValues = useMemo(
    () =>
      group
        ? {
            name: group.name || '',
            description: group.description || '',
            category: group.category || '',
            type: group.type || '',
            roles:
              Array.isArray(group.roles) && group.roles.length > 0
                ? group.roles
                : [],
          }
        : {},
    [group],
  );

  // ── Loading state ──────────────────────────────────────────────────
  if (!fetchInitialized || fetchingGroup) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <PageHeader
          title={t('groups:admin.edit.title', 'Edit Group')}
          subtitle={t('groups:admin.edit.subtitle', 'Update group details')}
          icon={<GroupIcon width={24} height={24} />}
        />

        <Grid columns={{ initial: '1', md: '280px 1fr' }} gap='6' align='start'>
          <Loader variant='skeleton' skeletonCount={3} />
          <Loader variant='skeleton' skeletonCount={6} />
        </Grid>
      </Box>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (!group || groupLoadError) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <PageHeader
          title={t('groups:admin.edit.title', 'Edit Group')}
          subtitle={t('groups:admin.edit.subtitle', 'Update group details')}
          icon={<GroupIcon width={24} height={24} />}
        />

        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className='rounded-md border border-(--red-6) bg-(--red-2)'
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('groups:admin.edit.errorLoading', 'Error loading group')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {groupLoadError ||
              t(
                'groups:admin.edit.errorLoadingDescription',
                'The group could not be found or loaded.',
              )}
          </Text>
          <Button
            variant='soft'
            color='red'
            onClick={() => dispatch(fetchGroupById(groupId))}
          >
            {t('common:retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <PageHeader
        title={group.name}
        subtitle={
          group.description ||
          t('groups:admin.edit.manageGroup', 'Manage group settings')
        }
        icon={<GroupIcon width={24} height={24} />}
      >
        <Button
          variant='ghost'
          color='gray'
          onClick={() => handleCancel(isDirtyRef.current)}
        >
          <ArrowLeftIcon />
          {t('groups:admin.edit.backToList', 'Back to Groups')}
        </Button>
      </PageHeader>

      <Form
        schema={updateGroupFormSchema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
      >
        <Grid columns={{ initial: '1', md: '280px 1fr' }} gap='6' align='start'>
          {/* Left: identity card */}
          <EditGroupIdentityCard group={group} />

          {/* Right: form sections */}
          <EditGroupFormFields
            onCancel={handleCancel}
            loading={loading}
            isDirtyRef={isDirtyRef}
            fetchRoles={fetchRoles}
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
  const [rolesLoadingMore, setRolesLoadingMore] = useState(false);
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
        // Silently handle error
      } finally {
        setRolesLoading(false);
        setRolesLoadingMore(false);
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
    if (!rolesLoadingMore && rolesHasMore) {
      loadRoles(rolesPage + 1, roleSearch, false);
    }
  }, [rolesLoadingMore, rolesHasMore, rolesPage, roleSearch, loadRoles]);

  return (
    <Card variant='surface' className='p-0'>
      {/* ── Group Information ──────────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        className='bg-(--gray-a2) border-b border-(--gray-a4)'
      >
        <Text size='2' weight='bold' color='gray'>
          {t('groups:admin.edit.groupInformation', 'Group Information')}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field
          name='name'
          label={t('groups:admin.edit.groupName', 'Group Name')}
          required
        >
          <Form.Input
            placeholder={t(
              'groups:admin.edit.groupNamePlaceholder',
              'e.g., Engineering, Marketing, Support',
            )}
          />
        </Form.Field>

        <Form.Field
          name='description'
          label={t('groups:admin.edit.description', 'Description')}
        >
          <Form.Textarea
            placeholder={t(
              'groups:admin.edit.descriptionPlaceholder',
              'Describe what this group is for...',
            )}
            rows={3}
          />
        </Form.Field>

        <Grid columns={{ initial: '1', sm: '2' }} gap='4'>
          <Form.Field
            name='category'
            label={t('groups:admin.edit.category', 'Category')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t(
                'groups:admin.edit.categoryPlaceholder',
                'e.g., System, Organization, Department',
              )}
            />
          </Form.Field>
          <Form.Field
            name='type'
            label={t('groups:admin.edit.type', 'Type')}
            className='mb-0'
          >
            <Form.Input
              placeholder={t(
                'groups:admin.edit.typePlaceholder',
                'e.g., Security, Organizational, Functional',
              )}
            />
          </Form.Field>
        </Grid>
      </Box>

      {/* ── Roles Selection ────────────────────────────────────────── */}
      <Box
        px='5'
        py='3'
        className='bg-(--gray-a2) border-y border-(--gray-a4)'
      >
        <Text size='2' weight='bold' color='gray'>
          {t('groups:admin.edit.rolesCount', 'Roles ({{count}} selected)', {
            count: selectedRoles.length,
          })}
        </Text>
      </Box>
      <Box p='5'>
        <Form.Field name='roles'>
          <Form.CheckboxList
            items={roles}
            valueKey='name'
            labelKey='name'
            descriptionKey='description'
            loading={rolesLoading}
            loadingMore={rolesLoadingMore}
            hasMore={rolesHasMore}
            onLoadMore={handleLoadMoreRoles}
            searchable
            searchPlaceholder={t(
              'groups:admin.edit.searchRoles',
              'Search roles...',
            )}
            searchValue={roleSearch}
            onSearch={setRoleSearch}
            emptyMessage={t('groups:admin.edit.noRolesFound', 'No roles found')}
            loadingMessage={t(
              'groups:admin.edit.loadingRoles',
              'Loading roles...',
            )}
          />
        </Form.Field>
      </Box>

      {/* ── Footer actions ───────────────────────────────────────── */}
      <Flex
        align='center'
        justify='between'
        px='5'
        py='4'
        className='rounded-b-md bg-(--gray-2) border-t border-(--gray-a4)'
      >
        <Button
          variant='soft'
          color='gray'
          type='button'
          onClick={handleCancel}
        >
          {t('groups:admin.edit.cancel', 'Cancel')}
        </Button>
        <Button variant='solid' color='indigo' type='submit' loading={loading}>
          {loading
            ? t('groups:admin.edit.saving', 'Saving...')
            : t('groups:admin.edit.saveChanges', 'Save Changes')}
        </Button>
      </Flex>
    </Card>
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
