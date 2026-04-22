/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import {
  ChevronDownIcon,
  PersonIcon,
  LightningBoltIcon,
  ArrowUpIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import { Flex, Text, Box, DropdownMenu, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { Link, useHistory } from '@shared/renderer/components/History';
import { checkPermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
const {
  getUserDisplayName,
  getUserAvatarUrl,
  getUserRoles,
  getUserProfile,
  logout,
} = features;
import { useWebSocket } from '@shared/ws/client';

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

  // Get avatar initial
  const avatarInitial = useMemo(() => {
    return displayName ? displayName.charAt(0).toUpperCase() : 'A';
  }, [displayName]);

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
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger>
        <Button
          variant='ghost'
          className='px-2 py-1 h-auto rounded-md cursor-pointer transition-colors bg-transparent hover:bg-gray-3 data-[state=open]:bg-gray-3 border-none outline-none flex items-center gap-2'
        >
          <Flex
            align='center'
            justify='center'
            className='w-8 h-8 rounded-full bg-indigo-3 text-indigo-11 overflow-hidden font-bold text-sm flex items-center justify-center'
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
              avatarInitial
            )}
          </Flex>
          <Flex
            direction='column'
            className='hidden md:flex md:flex-col items-start'
          >
            <Text
              size='3'
              weight='medium'
              className='text-gray-12 leading-none'
            >
              {displayName}
            </Text>
            <Text size='1' color='gray' className='leading-none mt-[2px]'>
              {displayRole}
            </Text>
          </Flex>
          <Box className='flex text-gray-11 transition-transform duration-200 ml-1 data-[state=open]:rotate-180'>
            <ChevronDownIcon width={12} height={12} />
          </Box>
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content
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

        <DropdownMenu.Item asChild>
          <Link
            to='/profile'
            className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 hover:text-gray-12 focus:outline-none focus:bg-gray-3 no-underline'
          >
            <PersonIcon width={16} height={16} />
            {t('navigation.profile', 'Profile')}
          </Link>
        </DropdownMenu.Item>

        {checkPermission(userProfile, 'nodered:admin') && (
          <DropdownMenu.Item asChild>
            <a
              href='/~/red/admin'
              className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 hover:text-gray-12 focus:outline-none focus:bg-gray-3 no-underline'
            >
              <LightningBoltIcon width={16} height={16} />
              Node-RED
            </a>
          </DropdownMenu.Item>
        )}

        <DropdownMenu.Item asChild>
          <Link
            to='/'
            className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 hover:text-gray-12 focus:outline-none focus:bg-gray-3 no-underline'
          >
            <ArrowUpIcon width={16} height={16} />
            {t('navigation.backToSite', 'Back to Site')}
          </Link>
        </DropdownMenu.Item>

        <DropdownMenu.Separator className='h-[1px] bg-gray-a6 my-1 mx-1' />

        <DropdownMenu.Item
          onClick={handleLogout}
          className='w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-red-11 hover:bg-red-3 hover:text-red-11 focus:outline-none focus:bg-red-3'
        >
          <ExitIcon width={16} height={16} />
          {t('navigation.logout', 'Logout')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export default ProfileDropdown;
