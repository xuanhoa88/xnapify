/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';

import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import { Flex, Box, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import { features } from '@shared/renderer/redux';
const { isAuthenticated, toggleDrawer } = features;

import Breadcrumbs from './Breadcrumbs';
import LanguageSwitcher from './LanguageSwitcher';
import Messages from './Messages';
import Notifications from './Notifications';
import ProfileDropdown from './ProfileDropdown';

import s from './Header.css';

/**
 * AdminHeader Component
 *
 * A modern, professional header specifically designed for admin panel pages.
 * Composed of: Breadcrumbs, SearchBar, and ProfileDropdown sub-components mapped to Radix UI.
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
    <Box as='header' position='sticky' top='0' className={s.headerBox}>
      <Flex align='center' justify='between' height='100%' px='4'>
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

        {/* Right Section - Language | Notifications Group | User */}
        <Flex align='center' gap='3'>
          <LanguageSwitcher />

          <Box className={s.divider} />

          <Flex align='center' gap='2'>
            <Messages />
            <Notifications />
          </Flex>

          <Box className={s.divider} />

          <ProfileDropdown />
        </Flex>
      </Flex>
    </Box>
  );
}

export default AdminHeader;
