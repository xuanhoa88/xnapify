/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useMemo } from 'react';

import {
  ChatBubbleIcon,
  FileTextIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import { Flex, Text, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { Link } from '@shared/renderer/components/History/index.js';
import Loader from '@shared/renderer/components/Loader/index.js';

import WidgetCard from './WidgetCard.js';

import s from './AtAGlanceWidget.css';

export default function AtAGlanceWidget({ context }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Resolve selectors and thunks from DI container
  const { groupsState, rolesState, usersState } = useMemo(() => {
    const { container } = context;
    return {
      groupsState: container.resolve('groups:admin:state'),
      rolesState: container.resolve('roles:admin:state'),
      usersState: container.resolve('users:admin:state'),
    };
  }, [context]);

  const usersPagination = useSelector(usersState.selectors.getUsersPagination);
  const rolesPagination = useSelector(rolesState.selectors.getRolesPagination);
  const groupsPagination = useSelector(
    groupsState.selectors.getGroupsPagination,
  );

  const isUsersReady = useSelector(usersState.selectors.isUsersListInitialized);
  const isRolesReady = useSelector(rolesState.selectors.isRolesListInitialized);
  const isGroupsReady = useSelector(
    groupsState.selectors.isGroupsListInitialized,
  );

  useEffect(() => {
    if (!isUsersReady)
      dispatch(usersState.thunks.fetchUsers({ page: 1, limit: 1 }));
    if (!isRolesReady)
      dispatch(rolesState.thunks.fetchRoles({ page: 1, limit: 1 }));
    if (!isGroupsReady)
      dispatch(groupsState.thunks.fetchGroups({ page: 1, limit: 1 }));
  }, [
    dispatch,
    isUsersReady,
    isRolesReady,
    isGroupsReady,
    usersState,
    rolesState,
    groupsState,
  ]);

  const isInitialized = isUsersReady && isRolesReady && isGroupsReady;

  const stats = useMemo(
    () => [
      {
        icon: PersonIcon,
        color: 'var(--blue-9)',
        path: '/admin/users',
        label: t('default:dashboard.usersCount', '{{count}} Users', {
          count: isUsersReady && usersPagination ? usersPagination.total : 0,
        }),
      },
      {
        icon: FileTextIcon,
        color: 'var(--blue-9)',
        path: '/admin/roles',
        label: t('default:dashboard.rolesCount', '{{count}} Roles', {
          count: isRolesReady && rolesPagination ? rolesPagination.total : 0,
        }),
      },
      {
        icon: ChatBubbleIcon,
        color: 'var(--blue-9)',
        path: '/admin/groups',
        label: t('default:dashboard.groupsCount', '{{count}} Groups', {
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
    <WidgetCard title={t('default:dashboard.atAGlance', 'At a Glance')}>
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
          {t('default:dashboard.versionInfo', 'xnapify 1.0.0 running ')}
          <Link to='/admin/settings' className={s.interactiveLink}>
            {t('default:dashboard.defaultTheme', 'Default Theme')}
          </Link>
          .
        </Text>
      </Box>
    </WidgetCard>
  );
}

AtAGlanceWidget.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }).isRequired,
};
