/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';

import {
  HamburgerMenuIcon,
  GearIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons';
import { Flex, Box, Button, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { features } from '@shared/renderer/redux';

import Breadcrumbs from './Breadcrumbs';
import Notifications from './Notifications';
import ProfileDropdown from './ProfileDropdown';

const { isAuthenticated, toggleDrawer } = features;

/**
 * AdminHeader Component
 *
 * A modern, professional header specifically designed for admin panel pages.
 * Composed of: Breadcrumbs, Notifications, and ProfileDropdown sub-components mapped to Radix UI.
 */
function AdminHeader() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isAuth = useSelector(isAuthenticated);

  const handleToggleDrawer = useCallback(() => {
    dispatch(toggleDrawer('admin'));
  }, [dispatch]);

  if (!isAuth) {
    return null;
  }

  return (
    <Box
      as='header'
      position='sticky'
      top='0'
      className='z-40 bg-white border-b border-gray-200 h-16'
    >
      <Flex align='center' justify='between' className='h-full px-6'>
        {/* Left Section - Toggle & Breadcrumbs */}
        <Flex align='center' gap='3'>
          <Button
            display={{ initial: 'flex', md: 'none' }}
            variant='ghost'
            color='gray'
            onClick={handleToggleDrawer}
            title={t('common.toggleDrawer', 'Toggle drawer')}
          >
            <HamburgerMenuIcon width={20} height={20} />
          </Button>
          <Box display={{ initial: 'none', md: 'block' }}>
            <Breadcrumbs />
          </Box>
        </Flex>

        {/* Right Section - Page Title & Action Icons */}
        <Flex align='center' gap='5'>
          <Text
            size='3'
            weight='bold'
            className='text-gray-900 hidden lg:block'
          >
            {t('admin:dashboard.title', 'Dashboard')}
          </Text>

          <Flex align='center' gap='1'>
            <Notifications />

            <Flex
              align='center'
              justify='center'
              role='button'
              tabIndex={0}
              title={t('common.settings', 'Settings')}
              className='w-9 h-9 rounded-full text-gray-500 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900'
            >
              <GearIcon width={18} height={18} />
            </Flex>

            <Flex
              align='center'
              justify='center'
              role='button'
              tabIndex={0}
              title={t('common.help', 'Help')}
              className='w-9 h-9 rounded-full text-gray-500 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900'
            >
              <QuestionMarkCircledIcon width={18} height={18} />
            </Flex>

            <Box className='ml-1'>
              <ProfileDropdown />
            </Box>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
}

export default AdminHeader;
