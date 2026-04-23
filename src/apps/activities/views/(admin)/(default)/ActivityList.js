/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';

import { ActivityLogIcon, ReloadIcon, Cross2Icon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Heading,
  Text,
  Table,
  Button,
  Badge,
} from '@radix-ui/themes';
import format from 'date-fns/format';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Loader from '@shared/renderer/components/Loader';
import { SearchableSelect } from '@shared/renderer/components/SearchableSelect';
import { TablePagination } from '@shared/renderer/components/Table';

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
  const [eventFilter, setEventFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  useEffect(() => {
    dispatch(
      thunks.fetchActivities({
        page: currentPage,
        event: eventFilter,
        entity_type: entityTypeFilter,
      }),
    );
  }, [dispatch, currentPage, eventFilter, entityTypeFilter]);

  const refreshActivities = useCallback(() => {
    dispatch(
      thunks.fetchActivities({
        page: currentPage,
        event: eventFilter,
        entity_type: entityTypeFilter,
      }),
    );
  }, [dispatch, currentPage, eventFilter, entityTypeFilter]);

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

  // Loading state (first fetch / not initialized)
  if (!initialized || (loading && activities.length === 0)) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className='pb-4 border-b border-[var(--gray-a6)] mb-6'
        >
          <Flex align='center' gap='3'>
            <Flex
              align='center'
              justify='center'
              className='w-10 h-10 rounded-[var(--radius-3)] bg-[var(--gray-3)] text-[var(--gray-11)] shrink-0'
            >
              <ActivityLogIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:activities.title', 'Activity Logs')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:activities.subtitle',
                  'System audit trail and event history',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Loader
          variant='skeleton'
          message={t('admin:activities.loading', 'Loading activity logs...')}
        />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box className='p-6 max-w-[1400px] mx-auto'>
        <Flex
          align='center'
          justify='between'
          wrap='wrap'
          gap='4'
          className='pb-4 border-b border-[var(--gray-a6)] mb-6'
        >
          <Flex align='center' gap='3'>
            <Flex
              align='center'
              justify='center'
              className='w-10 h-10 rounded-[var(--radius-3)] bg-[var(--gray-3)] text-[var(--gray-11)] shrink-0'
            >
              <ActivityLogIcon width={24} height={24} />
            </Flex>
            <Flex direction='column'>
              <Heading size='6'>
                {t('admin:activities.title', 'Activity Logs')}
              </Heading>
              <Text size='2' color='gray' mt='1'>
                {t(
                  'admin:activities.subtitle',
                  'System audit trail and event history',
                )}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className='border border-[var(--red-6)] rounded-[var(--radius-3)] bg-[var(--red-2)]'
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('admin:activities.errorLoading', 'Error loading activity logs')}
          </Text>
          <Text color='red' size='2' mb='4'>
            {error}
          </Text>
          <Button
            variant='soft'
            color='red'
            onClick={refreshActivities}
            size='2'
          >
            {t('common:retry', 'Retry')}
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className='p-6 max-w-[1400px] mx-auto'>
      <Flex align='center' justify='between' wrap='wrap' gap='4' pb='4' mb='6'>
        <Flex align='center' gap='3'>
          <Flex
            align='center'
            justify='center'
            className='w-10 h-10 rounded-[var(--radius-3)] bg-[var(--gray-3)] text-[var(--gray-11)] shrink-0'
          >
            <ActivityLogIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {t('admin:activities.title', 'Activity Logs')}
            </Heading>
            <Text size='2' color='gray' mt='1'>
              {t(
                'admin:activities.subtitle',
                'System audit trail and event history',
              )}
            </Text>
          </Flex>
        </Flex>
        <Flex align='center' gap='3'>
          <Button
            variant='ghost'
            size='2'
            onClick={refreshActivities}
            disabled={loading}
          >
            <ReloadIcon width={16} height={16} />
            {t('common:refresh', 'Refresh')}
          </Button>
        </Flex>
      </Flex>

      <Box className='bg-[var(--color-panel-solid)] rounded-[var(--radius-4)] shadow-[var(--shadow-2)] border border-[var(--gray-a6)] overflow-hidden relative'>
        <Flex
          gap='3'
          align='center'
          wrap='wrap'
          p='4'
          className='border-b border-[var(--gray-a6)] bg-[var(--gray-2)]'
        >
          <SearchableSelect
            className='w-[200px]'
            options={eventOptions}
            value={eventFilter}
            onChange={handleEventFilterChange}
            placeholder={t('admin:activities.filter.allEvents', 'All Events')}
            showSearch={false}
          />

          <SearchableSelect
            className='w-[200px]'
            options={entityTypeOptions}
            value={entityTypeFilter}
            onChange={handleEntityTypeFilterChange}
            placeholder={t(
              'admin:activities.filter.allEntities',
              'All Entities',
            )}
            showSearch={false}
          />

          <Box className='flex items-center min-w-max'>
            {hasActiveFilters && (
              <Button
                variant='ghost'
                size='2'
                onClick={handleClearAllFilters}
                type='button'
                title={t(
                  'admin:activities.filter.resetAll',
                  'Reset all filters',
                )}
              >
                <Cross2Icon width={12} height={12} />
                {t('admin:activities.filter.clear', 'Clear Filters')}
              </Button>
            )}
          </Box>
        </Flex>

        <Box className='relative overflow-x-auto'>
          <Table.Root variant='ghost'>
            <Table.Header className='bg-[var(--color-panel-solid)]'>
              <Table.Row>
                <Table.ColumnHeaderCell className='py-3'>
                  {t('admin:activities.column.event', 'Event')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className='py-3'>
                  {t('admin:activities.column.entity', 'Entity')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className='py-3'>
                  {t('admin:activities.column.actor', 'Actor')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className='py-3'>
                  {t('admin:activities.column.timestamp', 'Timestamp')}
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {activities.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Flex
                      justify='center'
                      align='center'
                      direction='column'
                      py='9'
                      className='opacity-60'
                    >
                      <ActivityLogIcon
                        width={48}
                        height={48}
                        className='mb-3'
                      />

                      <Text size='3' weight='bold' mb='1'>
                        {t(
                          'admin:activities.noLogsFound',
                          'No activity logs found',
                        )}
                      </Text>
                      <Text size='2'>
                        {t(
                          'admin:activities.noLogsDescription',
                          'Activity logs will appear here as system events occur. Try adjusting your filters.',
                        )}
                      </Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                activities.map(record => (
                  <Table.Row key={record.id}>
                    <Table.Cell className='py-3'>
                      <Badge color='blue' radius='full' variant='soft' size='2'>
                        {record.event}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className='py-3'>
                      <Flex align='center' gap='2'>
                        <Badge
                          color='gray'
                          radius='full'
                          variant='surface'
                          size='2'
                        >
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
                    </Table.Cell>
                    <Table.Cell className='py-3'>
                      {record.actor_id ? (
                        <Box
                          as='code'
                          className='font-mono bg-[var(--indigo-2)] text-[var(--indigo-11)] py-1 px-2 rounded-[var(--radius-1)] text-[13px]'
                        >
                          {record.actor_id}
                        </Box>
                      ) : (
                        '—'
                      )}
                    </Table.Cell>
                    <Table.Cell className='py-3'>
                      <Text size='2' color='gray'>
                        {record.created_at
                          ? format(
                              new Date(record.created_at),
                              'MMM dd, yyyy HH:mm',
                            )
                          : '—'}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>

        {loading && activities.length > 0 && (
          <Box className='absolute inset-0 bg-[var(--color-background)] opacity-50 flex items-center justify-center z-10'>
            <Loader variant='spinner' />
          </Box>
        )}

        {pagination && pagination.pages > 1 && (
          <Box className='bg-[var(--gray-1)]'>
            <TablePagination
              currentPage={currentPage}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              onPageChange={setCurrentPage}
              loading={loading}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ActivityList;
