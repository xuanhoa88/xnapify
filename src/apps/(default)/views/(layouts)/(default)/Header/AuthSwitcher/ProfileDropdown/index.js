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
import { Flex, Text, Box, DropdownMenu } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import { checkPermission } from '@shared/renderer/components/Rbac';
import {
  getUserDisplayName,
  getUserEmail,
  getUserAvatarUrl,
  getUserProfile,
  logout,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

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
      className='group border-none font-inherit text-inherit flex items-center px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-3)] cursor-pointer transition-colors duration-200 bg-transparent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-8)] focus-visible:outline-offset-[-1px] hover:bg-[var(--gray-3)] data-[state=open]:bg-[var(--gray-3)]'
    >
      <Flex align='center' gap='2'>
        <Flex
          align='center'
          justify='center'
          className='w-8 h-8 rounded-full bg-[var(--indigo-3)] text-[var(--indigo-11)] overflow-hidden font-bold text-[length:var(--font-size-2)] flex items-center justify-center'
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
        <Text size='3' weight='medium' className='hidden md:block'>
          {displayName}
        </Text>
        <Box className='flex text-[var(--gray-11)] transition-transform duration-200 group-data-[state=open]:rotate-180'>
          <ChevronDownIcon width={12} height={12} />
        </Box>
      </Flex>
    </button>
  );

  // Before mount: render static placeholder (no DropdownMenu wrapper)
  if (!mounted) {
    return <Box position='relative'>{triggerButton}</Box>;
  }

  // After mount: full interactive DropdownMenu
  return (
    <Box position='relative'>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>{triggerButton}</DropdownMenu.Trigger>

        <DropdownMenu.Content
          align='end'
          variant='soft'
          size='3'
          className='min-w-[200px] shadow-[var(--shadow-4)]'
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
          <DropdownMenu.Separator />

          {/* Navigation Items */}
          <DropdownMenu.Item onClick={() => history.push('/profile')}>
            <PersonIcon
              width={16}
              height={16}
              className='mr-[var(--space-2)]'
            />
            {t('navigation.profile', 'Profile')}
          </DropdownMenu.Item>

          {checkPermission(userProfile, 'nodered:admin') && (
            <DropdownMenu.Item
              onClick={() => {
                window.location.href = '/~/red/admin';
              }}
            >
              <LightningBoltIcon
                width={16}
                height={16}
                className='mr-[var(--space-2)]'
              />
              {t('navigation.nodeRed', 'Node-RED')}
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Item onClick={() => history.push('/admin')}>
            <GearIcon width={16} height={16} className='mr-[var(--space-2)]' />
            {t('navigation.admin', 'Admin Panel')}
          </DropdownMenu.Item>

          <DropdownMenu.Separator />

          <DropdownMenu.Item color='red' onClick={handleLogout}>
            <ExitIcon width={16} height={16} className='mr-[var(--space-2)]' />
            {t('navigation.logout', 'Logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Box>
  );
}

export default ProfileDropdown;
