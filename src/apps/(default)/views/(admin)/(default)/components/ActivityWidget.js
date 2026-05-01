/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect } from 'react';

import { Box, Flex, Text } from '@radix-ui/themes';
import {
  getActivities,
  isActivitiesInitialized,
} from 'apps/activities/views/(admin)/redux/selector';
import { fetchActivities } from 'apps/activities/views/(admin)/redux/thunks';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { Link } from '@shared/renderer/components/History';
import Loader from '@shared/renderer/components/Loader';

import WidgetCard from './WidgetCard';

import s from './ActivityWidget.css';

export default function ActivityWidget() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const activities = useSelector(getActivities);
  const isInitialized = useSelector(isActivitiesInitialized);

  useEffect(() => {
    if (!isInitialized) {
      dispatch(fetchActivities({ page: 1, limit: 3 }));
    }
  }, [dispatch, isInitialized]);

  // Display top 3 or fallback
  const displayActivities =
    activities && activities.length > 0 ? activities.slice(0, 3) : null;

  return (
    <WidgetCard title={t('admin:dashboard.activity', 'Activity')}>
      <Flex direction='column' gap='4'>
        <Box>
          <Text size='2' weight='bold' className={s.sectionTitle}>
            {t('admin:dashboard.recentActivity', 'Recent Activity')}
          </Text>

          {!isInitialized ? (
            <Loader variant='skeleton' skeletonCount={3} />
          ) : displayActivities ? (
            displayActivities.map((activity, idx) => (
              <Flex key={idx} justify='between' align='center' mb='2'>
                <Text size='2' color='gray'>
                  {activity.created_at
                    ? new Date(activity.created_at).toLocaleDateString()
                    : 'Unknown Date'}
                </Text>
                <Link to={`/admin/activities`} className={s.interactiveLink}>
                  <Text size='2'>{activity.event || 'System Action'}</Text>
                </Link>
              </Flex>
            ))
          ) : (
            <Text size='2' color='gray'>
              {t('admin:dashboard.noActivity', 'No recent activity.')}
            </Text>
          )}
        </Box>

        <Flex gap='2' className={s.sectionContainer}>
          <Link to='/admin/activities' className={s.interactiveLink}>
            <Text size='1'>
              {t('admin:dashboard.viewAllActivity', 'View All Activity')}
            </Text>
          </Link>
        </Flex>
      </Flex>
    </WidgetCard>
  );
}
