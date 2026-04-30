import { useEffect } from 'react';

import {
  ChatBubbleIcon,
  FileTextIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import { Flex, Text, Box } from '@radix-ui/themes';
import {
  getGroupsPagination,
  isGroupsListInitialized,
} from 'apps/groups/views/(admin)/redux/selector';
import { fetchGroups } from 'apps/groups/views/(admin)/redux/thunks';
import {
  getRolesPagination,
  isRolesListInitialized,
} from 'apps/roles/views/(admin)/redux/selector';
import { fetchRoles } from 'apps/roles/views/(admin)/redux/thunks';
import {
  getUsersPagination,
  isUsersListInitialized,
} from 'apps/users/views/(admin)/redux/selector';
import { fetchUsers } from 'apps/users/views/(admin)/redux/thunks';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { Link } from '@shared/renderer/components/History';

import WidgetCard from './WidgetCard';

import s from './AtAGlanceWidget.css';

export default function AtAGlanceWidget() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const usersPagination = useSelector(getUsersPagination);
  const rolesPagination = useSelector(getRolesPagination);
  const groupsPagination = useSelector(getGroupsPagination);

  const isUsersInitialized = useSelector(isUsersListInitialized);
  const isRolesInitialized = useSelector(isRolesListInitialized);
  const isGroupsInitialized = useSelector(isGroupsListInitialized);

  useEffect(() => {
    // Only fetch if data is not already present to avoid redundant API calls
    if (!isUsersInitialized) dispatch(fetchUsers({ page: 1, limit: 1 }));
    if (!isRolesInitialized) dispatch(fetchRoles({ page: 1, limit: 1 }));
    if (!isGroupsInitialized) dispatch(fetchGroups({ page: 1, limit: 1 }));
  }, [dispatch, isUsersInitialized, isRolesInitialized, isGroupsInitialized]);

  const usersCount =
    isUsersInitialized && usersPagination ? usersPagination.total : 0;
  const rolesCount =
    isRolesInitialized && rolesPagination ? rolesPagination.total : 0;
  const groupsCount =
    isGroupsInitialized && groupsPagination ? groupsPagination.total : 0;

  return (
    <WidgetCard title={t('admin:dashboard.atAGlance', 'At a Glance')}>
      <Flex wrap='wrap' gap='4'>
        <Flex align='center' gap='2' className={s.statColumn}>
          <PersonIcon color='var(--blue-9)' />
          <Link to='/admin/users' className={s.interactiveLink}>
            <Text size='2'>
              {t('admin:dashboard.usersCount', '{{count}} Users', {
                count: usersCount,
              })}
            </Text>
          </Link>
        </Flex>
        <Flex align='center' gap='2' className={s.statColumn}>
          <FileTextIcon color='var(--blue-9)' />
          <Link to='/admin/roles' className={s.interactiveLink}>
            <Text size='2'>
              {t('admin:dashboard.rolesCount', '{{count}} Roles', {
                count: rolesCount,
              })}
            </Text>
          </Link>
        </Flex>
        <Flex align='center' gap='2' className={s.statColumn}>
          <ChatBubbleIcon color='var(--blue-9)' />
          <Link to='/admin/groups' className={s.interactiveLink}>
            <Text size='2'>
              {t('admin:dashboard.groupsCount', '{{count}} Groups', {
                count: groupsCount,
              })}
            </Text>
          </Link>
        </Flex>
      </Flex>

      <Box mt='4'>
        <Text size='2' color='gray'>
          {t('admin:dashboard.versionInfo', 'xnapify 1.0.0 running ')}
          <Link to='/admin/settings' className={s.interactiveLink}>
            {t('admin:dashboard.defaultTheme', 'Default Theme')}
          </Link>
          .
        </Text>
      </Box>
    </WidgetCard>
  );
}
