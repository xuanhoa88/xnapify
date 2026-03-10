/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { isAuthenticated, toggleDrawer } from '@shared/renderer/redux';
import Icon from '@shared/renderer/components/Icon';
import Button from '@shared/renderer/components/Button';
import LanguageSwitcher from './LanguageSwitcher';
import Breadcrumbs from './Breadcrumbs';
import Messages from './Messages';
import Notifications from './Notifications';
import ProfileDropdown from './ProfileDropdown';
import s from './Header.css';

/**
 * AdminHeader Component
 *
 * A modern, professional header specifically designed for admin panel pages.
 * Composed of: Breadcrumbs, SearchBar, and ProfileDropdown sub-components.
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
    <header className={s.adminHeader}>
      <div className={s.headerContainer}>
        {/* Left Section - Toggle & Breadcrumbs */}
        <div className={s.leftSection}>
          <Button
            variant='ghost'
            iconOnly
            onClick={handleToggleDrawer}
            title={t('common.toggleDrawer', 'Toggle drawer')}
          >
            <Icon name='menu' size={20} />
          </Button>
          <Breadcrumbs />
        </div>

        {/* Right Section - Language | Notifications Group | User */}
        <div className={s.rightSection}>
          <LanguageSwitcher />
          <span className={s.divider} />
          <Messages />
          <Notifications />
          <span className={s.divider} />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
