/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

import {
  ChevronDownIcon,
  PersonIcon,
  LightningBoltIcon,
  GearIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import { Flex, Text, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu/index.js';
import { useHistory } from '@shared/renderer/components/History/index.js';
import { checkPermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';
import { useWebSocket } from '@shared/ws/client/index.js';

const {
  getUserDisplayName,
  getUserEmail,
  getUserAvatarUrl,
  getUserProfile,
  logout,
} = features;

/**
 * ProfileDropdown Component
 *
 * Renders a static trigger button during SSR to avoid hydration mismatches.
 * After mount, upgrades to the full interactive Radix DropdownMenu.
 */
function ProfileDropdown() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redux state
  const displayName = useSelector(getUserDisplayName);
  const email = useSelector(getUserEmail);
  const avatarUrl = useSelector(getUserAvatarUrl);
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
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  }, [displayName]);

  // Static trigger button — rendered identically on server and client
  // before mount to guarantee zero hydration mismatch.
  const triggerButton = (
    <button
      type='button'
      className='group border-none font-inherit text-inherit flex items-center p-1 pr-2 rounded-full cursor-pointer transition-all duration-200 bg-transparent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--focus-8) focus-visible:-outline-offset-1 hover:bg-(--gray-a3) data-[state=open]:bg-(--gray-a3) active:scale-95'
    >
      <Flex align='center' gap='2'>
        <Flex
          align='center'
          justify='center'
          className='w-8 h-8 rounded-full bg-linear-to-br from-(--indigo-4) to-(--indigo-6) text-(--indigo-11) overflow-hidden font-bold text-xs flex items-center justify-center shadow-inner ring-1 ring-(--gray-a4)'
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
        <Text
          size='2'
          weight='medium'
          className='hidden md:block text-(--gray-11) group-hover:text-(--gray-12) transition-colors'
        >
          {displayName}
        </Text>
        <Box className='flex text-(--gray-9) transition-transform duration-200 group-data-[state=open]:rotate-180 group-hover:text-(--gray-12)'>
          <ChevronDownIcon width={14} height={14} />
        </Box>
      </Flex>
    </button>
  );

  // Before mount: render static placeholder (no DropdownMenu wrapper)
  if (!mounted) {
    return <Box position='relative'>{triggerButton}</Box>;
  }

  // After mount: full interactive ContextMenu
  return (
    <Box position='relative'>
      <ContextMenu>
        <ContextMenu.Trigger asChild>{triggerButton}</ContextMenu.Trigger>

        <ContextMenu.Menu
          align='end'
          variant='soft'
          size='3'
          className='min-w-[200px] shadow-(--shadow-4)'
        >
          {/* Header */}
          <Box py='2' px='3' mb='1'>
            <Text as='div' size='3' weight='bold'>
              {displayName}
            </Text>
            <Text as='div' size='1' color='gray' mt='1'>
              {email}
            </Text>
          </Box>
          <ContextMenu.Divider />

          {/* Navigation Items */}
          <ContextMenu.Item onClick={() => history.push('/profile')}>
            <PersonIcon width={16} height={16} className='mr-(--space-2)' />
            {t('navigation.profile', 'Profile')}
          </ContextMenu.Item>

          {checkPermission(userProfile, 'nodered:admin') && (
            <ContextMenu.Item
              onClick={() => {
                window.location.href = '/~/red/admin';
              }}
            >
              <LightningBoltIcon
                width={16}
                height={16}
                className='mr-(--space-2)'
              />
              {t('navigation.nodeRed', 'Node-RED')}
            </ContextMenu.Item>
          )}

          <ContextMenu.Item onClick={() => history.push('/admin')}>
            <GearIcon width={16} height={16} className='mr-(--space-2)' />
            {t('navigation.admin', 'Admin Panel')}
          </ContextMenu.Item>

          <ContextMenu.Divider />

          <ContextMenu.Item variant='danger' onClick={handleLogout}>
            <ExitIcon width={16} height={16} className='mr-(--space-2)' />
            {t('navigation.logout', 'Logout')}
          </ContextMenu.Item>
        </ContextMenu.Menu>
      </ContextMenu>
    </Box>
  );
}

export default ProfileDropdown;
