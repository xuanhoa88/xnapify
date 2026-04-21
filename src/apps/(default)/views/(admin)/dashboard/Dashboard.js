/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useState, useCallback } from 'react';

import { ActivityLogIcon, DashboardIcon } from '@radix-ui/react-icons';
import {
  Flex,
  Box,
  Text,
  Heading,
  Table,
  Button,
  Badge,
} from '@radix-ui/themes';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Loader from '@shared/renderer/components/Loader';
import {
  TablePagination,
  TableSearch,
} from '@shared/renderer/components/Table';

import {
  fetchActivities,
  getActivities,
  getActivitiesTotal,
  getActivitiesPagination,
  isActivitiesLoading,
  isActivitiesInitialized,
  getActivitiesError,
} from './redux';

import s from './Dashboard.css';

const getStatusTagVariant = status => {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'failed':
      return 'error';
    case 'pending':
    default:
      return 'warning';
  }
};

/**
 * Admin Dashboard converting CSS structural classes to Radix inline Box explicit objects matching expected legacy formatting organically.
 */
function Dashboard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activities = useSelector(getActivities);
  const total = useSelector(getActivitiesTotal);
  const pagination = useSelector(getActivitiesPagination);
  const loading = useSelector(isActivitiesLoading);
  const initialized = useSelector(isActivitiesInitialized);
  const error = useSelector(getActivitiesError);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(fetchActivities({ page: currentPage, limit: 20, search }));
  }, [dispatch, currentPage, search]);

  const handlePageChange = useCallback(page => {
    setCurrentPage(page);
  }, []);

  const handleSearch = useCallback(value => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const refreshActivities = useCallback(() => {
    dispatch(fetchActivities({ page: currentPage, limit: 20, search }));
  }, [dispatch, currentPage, search]);

  const renderContent = () => {
    // Show loading on first fetch (not initialized) or when loading with no data
    if (!initialized || (loading && activities.length === 0)) {
      return (
        <Loader
          variant='cards'
          message={t(
            'admin:dashboard.loadingActivities',
            'Loading activities...',
          )}
        />
      );
    }

    // Error state
    if (error) {
      return (
        <Flex
          direction='column'
          align='center'
          justify='center'
          p='6'
          className={s.errorFlex}
        >
          <Text color='red' size='4' weight='bold' mb='2'>
            {t('admin:dashboard.errorLoading', 'Error loading activities')}
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
      );
    }

    return (
      <Box className={s.gridContainer}>
        {/* Activities Table */}
        <Box className={s.surfaceBox}>
          <Box className={s.headerBox}>
            <Flex align='center' gap='3'>
              <Heading as='h3' size='4'>
                {t('admin:dashboard.recentActivities', 'Recent Activities')}
              </Heading>
              {total > 0 && (
                <Badge size='1' radius='full' variant='surface'>
                  {total}
                </Badge>
              )}
            </Flex>
          </Box>
          <Box className={s.searchBox}>
            <TableSearch
              value={search}
              onChange={handleSearch}
              placeholder={t(
                'admin:dashboard.searchEvents',
                'Search events or metadata...',
              )}
            />
          </Box>

          <Box className={s.tableWrapper}>
            <Table.Root variant='surface'>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>
                    {t('admin:dashboard.event', 'Event')}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    {t('admin:dashboard.entity', 'Entity')}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    {t('admin:dashboard.action', 'Action')}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    {t('admin:dashboard.status', 'Status')}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    {t('admin:dashboard.time', 'Time')}
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {activities.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5}>
                      <Flex
                        justify='center'
                        align='center'
                        direction='column'
                        py='9'
                        className={s.emptyStateFlex}
                      >
                        <ActivityLogIcon
                          width={48}
                          height={48}
                          className={s.emptyStateIcon}
                        />

                        <Text size='3' weight='bold' mb='1'>
                          {t(
                            'admin:dashboard.noRecentActivity',
                            'No recent activities',
                          )}
                        </Text>
                        <Text size='2' color='gray'>
                          {t(
                            'admin:dashboard.noRecentActivityDescription',
                            'Activity will appear here as users interact with the system.',
                          )}
                        </Text>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  activities.map(activity => (
                    <Table.Row key={activity.id}>
                      <Table.Cell>
                        <Box as='code' className={s.codeBox}>
                          {(activity.metadata && activity.metadata.event) ||
                            activity.event ||
                            'N/A'}
                        </Box>
                      </Table.Cell>
                      <Table.Cell>
                        {activity.metadata &&
                        activity.metadata.entity_type &&
                        activity.metadata.entity_id ? (
                          <Flex direction='column' gap='1'>
                            <Text size='2' weight='medium'>
                              {activity.metadata.entity_type}
                            </Text>
                            <Text
                              size='1'
                              color='gray'
                              className={s.monospaceText}
                            >
                              {activity.metadata.entity_id}
                            </Text>
                          </Flex>
                        ) : (
                          <Text size='2' color='gray' className={s.italicText}>
                            N/A
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {(activity.metadata && activity.metadata.action) || (
                          <Text size='2' color='gray' className={s.italicText}>
                            N/A
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          variant={getStatusTagVariant(activity.status)}
                          color='gray'
                          radius='full'
                          size='2'
                        >
                          {activity.status === 'delivered'
                            ? t('admin:dashboard.statusDelivered', 'Delivered')
                            : activity.status === 'failed'
                              ? t('admin:dashboard.statusFailed', 'Failed')
                              : t('admin:dashboard.statusPending', 'Pending')}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {activity.created_at ? (
                          formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                          })
                        ) : (
                          <Text size='2' color='gray' className={s.italicText}>
                            N/A
                          </Text>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
            {loading && activities.length > 0 && (
              <Box className={s.loadingOverlay}>
                <Loader variant='spinner' />
              </Box>
            )}
          </Box>

          {pagination && pagination.pages > 1 && (
            <Box p='4' className={s.paginationBox}>
              <TablePagination
                currentPage={currentPage}
                totalPages={pagination.pages}
                totalItems={pagination.total}
                onPageChange={handlePageChange}
                loading={loading}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box className={s.containerBox}>
      <Flex
        align='center'
        justify='between'
        wrap='wrap'
        gap='4'
        pb='4'
        mb='6'
        className={s.adminHeader}
      >
        <Flex align='center' gap='3'>
          <Flex align='center' justify='center' className={s.adminHeaderIcon}>
            <DashboardIcon width={24} height={24} />
          </Flex>
          <Flex direction='column'>
            <Heading size='6'>
              {t('admin:dashboard.title', 'Dashboard')}
            </Heading>
            <Text size='2' color='gray' mt='1'>
              {t(
                'admin:dashboard.subtitle',
                'Overview of your system activities',
              )}
            </Text>
          </Flex>
        </Flex>
      </Flex>
      {renderContent()}
    </Box>
  );
}

export default Dashboard;
