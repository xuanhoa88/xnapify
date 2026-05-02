/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';

import { ActivityLogIcon } from '@radix-ui/react-icons';
import { Box, Flex, Text, Badge } from '@radix-ui/themes';
import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import { DataTable, useTableColumns } from '@shared/renderer/components/Table';

import { selectors, thunks } from '../redux';

const ActivityList = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const activities = useSelector(selectors.getActivities);
  const pagination = useSelector(selectors.getActivitiesPagination);
  const loading = useSelector(selectors.isActivitiesLoading);
  const initialized = useSelector(selectors.isActivitiesInitialized);
  const error = useSelector(selectors.getActivitiesError);

  // Filter state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [eventFilter, setEventFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  useEffect(() => {
    dispatch(
      thunks.fetchActivities({
        page: currentPage,
        limit: pageSize,
        event: eventFilter,
        entity_type: entityTypeFilter,
      }),
    );
  }, [dispatch, currentPage, pageSize, eventFilter, entityTypeFilter]);

  const refreshActivities = useCallback(() => {
    dispatch(
      thunks.fetchActivities({
        page: currentPage,
        limit: pageSize,
        event: eventFilter,
        entity_type: entityTypeFilter,
      }),
    );
  }, [dispatch, currentPage, pageSize, eventFilter, entityTypeFilter]);

  // Filter handlers
  const handleEventFilterChange = useCallback(value => {
    setEventFilter(value);
    setCurrentPage(1);
  }, []);

  const handleEntityTypeFilterChange = useCallback(value => {
    setEntityTypeFilter(value);
    setCurrentPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setEventFilter('');
    setEntityTypeFilter('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = eventFilter || entityTypeFilter;

  const eventOptions = useMemo(
    () => [
      {
        value: '',
        label: t('admin:activities.filter.allEvents', 'All Events'),
      },
      { value: 'auth.logged_in', label: 'Auth: Login' },
      { value: 'auth.logout', label: 'Auth: Logout' },
      { value: 'auth.registered', label: 'Auth: Register' },
      { value: 'auth.email_verified', label: 'Auth: Email Verified' },
      { value: 'admin:users:created', label: 'Users: Created' },
      { value: 'admin:users:updated', label: 'Users: Updated' },
      { value: 'admin:users:deleted', label: 'Users: Deleted' },
      { value: 'admin:groups:created', label: 'Groups: Created' },
      { value: 'admin:groups:updated', label: 'Groups: Updated' },
      { value: 'admin:groups:deleted', label: 'Groups: Deleted' },
      { value: 'admin:roles:created', label: 'Roles: Created' },
      { value: 'admin:roles:updated', label: 'Roles: Updated' },
      { value: 'admin:roles:deleted', label: 'Roles: Deleted' },
    ],

    [t],
  );

  const entityTypeOptions = useMemo(
    () => [
      {
        value: '',
        label: t('admin:activities.filter.allEntities', 'All Entities'),
      },
      { value: 'user', label: 'User' },
      { value: 'group', label: 'Group' },
      { value: 'role', label: 'Role' },
      { value: 'permission', label: 'Permission' },
    ],

    [t],
  );

  const baseColumns = useMemo(
    () => [
      {
        key: 'event',
        dataIndex: 'event',
        title: t('admin:activities.column.event', 'Event'),
        order: 10,
        render: event => (
          <Badge color='blue' radius='full' variant='soft' size='2'>
            {event}
          </Badge>
        ),
      },
      {
        key: 'entity',
        title: t('admin:activities.column.entity', 'Entity'),
        order: 20,
        render: (_, record) => (
          <Flex align='center' gap='2'>
            <Badge color='gray' radius='full' variant='surface' size='2'>
              {record.entity_type}
            </Badge>
            {record.entity_id && (
              <Box
                as='code'
                className='font-mono bg-[var(--indigo-2)] text-[var(--indigo-11)] py-1 px-2 rounded-[var(--radius-1)] text-[13px]'
              >
                {record.entity_id}
              </Box>
            )}
          </Flex>
        ),
      },
      {
        key: 'actor',
        dataIndex: 'actor_id',
        title: t('admin:activities.column.actor', 'Actor'),
        order: 30,
        render: actor_id =>
          actor_id ? (
            <Box
              as='code'
              className='font-mono bg-[var(--indigo-2)] text-[var(--indigo-11)] py-1 px-2 rounded-[var(--radius-1)] text-[13px]'
            >
              {actor_id}
            </Box>
          ) : (
            '—'
          ),
      },
      {
        key: 'timestamp',
        dataIndex: 'created_at',
        title: t('admin:activities.column.timestamp', 'Timestamp'),
        order: 40,
        render: createdAt => (
          <Text size='2' color='gray'>
            {createdAt
              ? format(new Date(createdAt), 'MMM dd, yyyy HH:mm')
              : '—'}
          </Text>
        ),
      },
    ],
    [t],
  );

  const { columns } = useTableColumns(
    'table.columns.activities.list',
    baseColumns,
  );

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <DataTable
        columns={columns}
        dataSource={activities}
        rowKey='id'
        loading={loading}
        initialized={initialized}
      >
        <DataTable.Header
          title={t('admin:activities.title', 'Activity Logs')}
          subtitle={t(
            'admin:activities.subtitle',
            'System audit trail and event history',
          )}
          icon={<ActivityLogIcon width={24} height={24} />}
        />

        <DataTable.Toolbar>
          <DataTable.Filter
            component={SearchableSelect}
            width='md'
            options={eventOptions}
            value={eventFilter}
            onChange={handleEventFilterChange}
            placeholder={t('admin:activities.filter.allEvents', 'All Events')}
            showSearch={false}
          />
          <DataTable.Filter
            component={SearchableSelect}
            width='md'
            options={entityTypeOptions}
            value={entityTypeFilter}
            onChange={handleEntityTypeFilterChange}
            placeholder={t(
              'admin:activities.filter.allEntities',
              'All Entities',
            )}
            showSearch={false}
          />
          <DataTable.ClearFilters
            visible={!!hasActiveFilters}
            onClick={handleClearAllFilters}
          />
        </DataTable.Toolbar>

        <DataTable.Empty
          icon={<ActivityLogIcon width={48} height={48} />}
          title={t('admin:activities.noLogsFound', 'No activity logs found')}
          description={t(
            'admin:activities.noLogsDescription',
            'Activity logs will appear here as system events occur. Try adjusting your filters.',
          )}
        />
        <DataTable.Error message={error} onRetry={refreshActivities} />
        <DataTable.Loader />

        <DataTable.Pagination
          current={currentPage}
          totalPages={pagination ? pagination.pages : undefined}
          total={pagination ? pagination.total : undefined}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 100]}
          onChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </DataTable>
    </Box>
  );
};

export default ActivityList;
