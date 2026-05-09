/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import {
  PersonIcon,
  LightningBoltIcon,
  ArrowUpIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import { Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu/index.js';
import { useHistory } from '@shared/renderer/components/History/index.js';
import { checkPermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';
import { useWebSocket } from '@shared/ws/client/index.js';

const {
  getUserDisplayName,
  getUserAvatarUrl,
  getUserRoles,
  getUserProfile,
  logout,
} = features;

/**
 * ProfileDropdown Component
 * User profile dropdown with navigation and logout, using native Radix primitives
 */
function ProfileDropdown() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();

  // Redux state
  const displayName = useSelector(getUserDisplayName);
  const avatarUrl = useSelector(getUserAvatarUrl);
  const roles = useSelector(getUserRoles);
  const userProfile = useSelector(getUserProfile);

  const handleLogout = useCallback(
    async e => {
      e.preventDefault();
      await dispatch(logout());
      if (ws) {
        ws.logout();
      }
      const currentPath = history.location.pathname;
      history.replace(`/login?returnTo=${encodeURIComponent(currentPath)}`);
    },
    [dispatch, ws, history],
  );

  // Determine display role
  const displayRole = useMemo(() => {
    if (!roles || roles.length === 0) return t('common.user', 'User');

    // Filter out 'user' role to find more specific roles, unless it's the only one
    const specializedRole = roles.find(r => {
      const roleName = typeof r === 'string' ? r : r.name;
      return roleName !== 'user';
    });

    const roleToDisplay = specializedRole || roles[0];
    const roleName =
      typeof roleToDisplay === 'string' ? roleToDisplay : roleToDisplay.name;

    // Capitalize first letter
    return roleName.charAt(0).toUpperCase() + roleName.slice(1);
  }, [roles, t]);

  return (
    <ContextMenu>
      <ContextMenu.Trigger asChild>
        <button
          type='button'
          suppressHydrationWarning
          className='w-9 h-9 p-0 m-0 rounded-full cursor-pointer transition-colors bg-transparent hover:bg-gray-100 data-[state=open]:bg-gray-100 outline-none border-none flex items-center justify-center'
        >
          <Flex
            align='center'
            justify='center'
            className='w-8 h-8 rounded-full bg-orange-400 text-white overflow-hidden font-bold text-xs flex items-center justify-center border border-gray-200'
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=''
                className='w-full h-full object-cover'
                onError={e => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <PersonIcon width={16} height={16} />
            )}
          </Flex>
        </button>
      </ContextMenu.Trigger>

      <ContextMenu.Menu
        align='end'
        variant='soft'
        size='2'
        className='min-w-[200px] z-100 p-1 bg-(--color-panel-solid) backdrop-blur-md border border-(--gray-a6) rounded-(--radius-4) shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
      >
        <ContextMenu.Header title={displayName} subtitle={displayRole} />

        <ContextMenu.Item
          onClick={() => history.push('/profile')}
          className='cursor-pointer'
        >
          <Flex align='center' gap='2'>
            <PersonIcon width={16} height={16} />
            <Text size='2'>{t('navigation.profile', 'Profile')}</Text>
          </Flex>
        </ContextMenu.Item>

        {checkPermission(userProfile, 'nodered:admin') && (
          <ContextMenu.Item
            onClick={() => (window.location.href = '/~/red/admin')}
            className='cursor-pointer'
          >
            <Flex align='center' gap='2'>
              <LightningBoltIcon width={16} height={16} />
              <Text size='2'>Node-RED</Text>
            </Flex>
          </ContextMenu.Item>
        )}

        <ContextMenu.Item
          onClick={() => history.push('/')}
          className='cursor-pointer'
        >
          <Flex align='center' gap='2'>
            <ArrowUpIcon width={16} height={16} />
            <Text size='2'>{t('navigation.backToSite', 'Back to Site')}</Text>
          </Flex>
        </ContextMenu.Item>

        <ContextMenu.Divider />

        <ContextMenu.Item
          onClick={handleLogout}
          variant='danger'
          className='cursor-pointer'
        >
          <Flex align='center' gap='2'>
            <ExitIcon width={16} height={16} />
            <Text size='2'>{t('navigation.logout', 'Logout')}</Text>
          </Flex>
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

export default ProfileDropdown;
