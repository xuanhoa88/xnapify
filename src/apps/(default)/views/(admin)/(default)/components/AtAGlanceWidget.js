import { useEffect, useMemo } from 'react';

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
import Loader from '@shared/renderer/components/Loader';

import WidgetCard from './WidgetCard';

import s from './AtAGlanceWidget.css';

export default function AtAGlanceWidget() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const usersPagination = useSelector(getUsersPagination);
  const rolesPagination = useSelector(getRolesPagination);
  const groupsPagination = useSelector(getGroupsPagination);

  const isUsersReady = useSelector(isUsersListInitialized);
  const isRolesReady = useSelector(isRolesListInitialized);
  const isGroupsReady = useSelector(isGroupsListInitialized);

  useEffect(() => {
    if (!isUsersReady) dispatch(fetchUsers({ page: 1, limit: 1 }));
    if (!isRolesReady) dispatch(fetchRoles({ page: 1, limit: 1 }));
    if (!isGroupsReady) dispatch(fetchGroups({ page: 1, limit: 1 }));
  }, [dispatch, isUsersReady, isRolesReady, isGroupsReady]);

  const isInitialized = isUsersReady && isRolesReady && isGroupsReady;

  const stats = useMemo(
    () => [
      {
        icon: PersonIcon,
        color: 'var(--blue-9)',
        path: '/admin/users',
        label: t('admin:dashboard.usersCount', '{{count}} Users', {
          count: isUsersReady && usersPagination ? usersPagination.total : 0,
        }),
      },
      {
        icon: FileTextIcon,
        color: 'var(--blue-9)',
        path: '/admin/roles',
        label: t('admin:dashboard.rolesCount', '{{count}} Roles', {
          count: isRolesReady && rolesPagination ? rolesPagination.total : 0,
        }),
      },
      {
        icon: ChatBubbleIcon,
        color: 'var(--blue-9)',
        path: '/admin/groups',
        label: t('admin:dashboard.groupsCount', '{{count}} Groups', {
          count: isGroupsReady && groupsPagination ? groupsPagination.total : 0,
        }),
      },
    ],
    [
      t,
      isUsersReady,
      isRolesReady,
      isGroupsReady,
      usersPagination,
      rolesPagination,
      groupsPagination,
    ],
  );

  return (
    <WidgetCard title={t('admin:dashboard.atAGlance', 'At a Glance')}>
      {!isInitialized ? (
        <Loader variant='skeleton' skeletonCount={3} />
      ) : (
        <Flex wrap='wrap' gap='4'>
          {stats.map(({ icon: Icon, color, path, label }) => (
            <Flex key={path} align='center' gap='2' className={s.statColumn}>
              <Icon color={color} />
              <Link to={path} className={s.interactiveLink}>
                <Text size='2'>{label}</Text>
              </Link>
            </Flex>
          ))}
        </Flex>
      )}

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
