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
import { Flex, Text, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import { Link, useHistory } from '@shared/renderer/components/History';
import { checkPermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

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
        className='min-w-[200px] bg-panel-solid/90 backdrop-blur-md border border-gray-a6 rounded-md shadow-lg p-1 z-[100] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
      >
        <Box py='2' px='3' mb='1' className='border-b border-gray-a6 mb-2'>
          <Text as='div' size='2' weight='bold'>
            {displayName}
          </Text>
          <Text as='div' size='1' color='gray' mt='1'>
            {displayRole}
          </Text>
        </Box>

        <ContextMenu.Item asChild>
          <Link
            to='/profile'
            className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 hover:text-gray-12 focus:outline-none focus:bg-gray-3 no-underline'
          >
            <PersonIcon width={16} height={16} />
            {t('navigation.profile', 'Profile')}
          </Link>
        </ContextMenu.Item>

        {checkPermission(userProfile, 'nodered:admin') && (
          <ContextMenu.Item asChild>
            <a
              href='/~/red/admin'
              className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 hover:text-gray-12 focus:outline-none focus:bg-gray-3 no-underline'
            >
              <LightningBoltIcon width={16} height={16} />
              Node-RED
            </a>
          </ContextMenu.Item>
        )}

        <ContextMenu.Item asChild>
          <Link
            to='/'
            className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 hover:text-gray-12 focus:outline-none focus:bg-gray-3 no-underline'
          >
            <ArrowUpIcon width={16} height={16} />
            {t('navigation.backToSite', 'Back to Site')}
          </Link>
        </ContextMenu.Item>

        <ContextMenu.Divider className='h-[1px] bg-gray-a6 my-1 mx-1' />

        <ContextMenu.Item
          onClick={handleLogout}
          className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-red-11 hover:bg-red-3 hover:text-red-11 focus:outline-none focus:bg-red-3'
        >
          <ExitIcon width={16} height={16} />
          {t('navigation.logout', 'Logout')}
        </ContextMenu.Item>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

export default ProfileDropdown;
