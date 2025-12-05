/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect } from 'react';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  closeSidebar,
  isSidebarOpen,
  isAdminPanel,
  isAuthenticated,
  isAdmin,
  logout,
} from '../../redux';
import * as navigator from '../../navigator';
import Link from '../Link';
import s from './Sidebar.css';

function Sidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const sidebarOpen = useSelector(isSidebarOpen);
  const isAdminPanelActive = useSelector(isAdminPanel);
  const isAuth = useSelector(isAuthenticated);
  const isAdminActive = useSelector(isAdmin);

  // Track current path on client-side only to prevent hydration mismatch
  const [currentPath, setCurrentPath] = useState('');

  // Update current path on client-side after hydration and on route changes
  useEffect(() => {
    // Set initial path
    setCurrentPath(navigator.getCurrentLocation().pathname);

    // Listen for route changes
    const unsubscribe = navigator.listen(location => {
      setCurrentPath(location.pathname);
    });

    return unsubscribe;
  }, []);

  const handleCloseSidebar = useCallback(() => {
    dispatch(closeSidebar());
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    handleCloseSidebar();
  }, [dispatch, handleCloseSidebar]);

  const isActive = useCallback(
    (path, exact = false) => {
      // Return false during SSR to match initial server render
      if (!currentPath) return false;

      if (exact) {
        return currentPath === path;
      }
      return currentPath.startsWith(path);
    },
    [currentPath],
  );

  // Admin Menu Items
  const adminMenuItems = [
    {
      path: '/admin',
      label: t('navigation.admin', 'Admin Panel'),
      icon: '📊',
      exact: true,
    },
    { path: '/admin/users', label: t('navigation.users', 'Users'), icon: '👥' },
    { path: '/admin/roles', label: t('navigation.roles', 'Roles'), icon: '🎭' },
    {
      path: '/admin/groups',
      label: t('navigation.groups', 'Groups'),
      icon: '👨‍👩‍👧‍👦',
    },
    {
      path: '/admin/permissions',
      label: t('navigation.permissions', 'Permissions'),
      icon: '🔐',
    },
  ];

  // Primary Menu Items
  const primaryMenuItems = [
    { path: '/about', label: t('navigation.about', 'About'), icon: 'ℹ️' },
    { path: '/contact', label: t('navigation.contact', 'Contact'), icon: '📞' },
  ];

  if (!isAuth) {
    primaryMenuItems.push(
      { path: '/login', label: t('navigation.login', 'Login'), icon: '🔑' },
      {
        path: '/register',
        label: t('navigation.register', 'Register'),
        icon: '📝',
      },
    );
  }

  const renderMenu = items => (
    <ul className={s.menuList}>
      {items.map(item => (
        <li key={item.path} className={s.menuItem}>
          <Link
            to={item.path}
            className={clsx(s.menuLink, {
              [s.active]: isActive(item.path, item.exact),
            })}
            onClick={handleCloseSidebar}
          >
            <span className={s.menuIcon}>{item.icon}</span>
            <span className={s.menuLabel}>{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <aside className={clsx(s.sidebar, { [s.open]: sidebarOpen })}>
        <div className={s.sidebarHeader}>
          <h2 className={s.sidebarTitle}>
            {isAdminPanelActive
              ? t('navigation.admin', 'Admin Panel')
              : t('navigation.menu', 'Menu')}
          </h2>
          <button
            className={s.closeButton}
            onClick={handleCloseSidebar}
            aria-label='Close menu'
          >
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M18 6L6 18M6 6L18 18'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        </div>

        <nav className={s.nav}>
          {isAdminPanelActive ? (
            <>
              {renderMenu(adminMenuItems)}
              <div className={s.divider} />
              <ul className={s.menuList}>
                <li className={s.menuItem}>
                  <Link
                    to='/'
                    className={s.menuLink}
                    onClick={handleCloseSidebar}
                  >
                    <span className={s.menuIcon}>🏠</span>
                    <span className={s.menuLabel}>
                      {t('navigation.backToSite', 'Back to Site')}
                    </span>
                  </Link>
                </li>
              </ul>
            </>
          ) : (
            <>
              {renderMenu(primaryMenuItems)}
              {isAuth && isAdminActive && (
                <>
                  <div className={s.divider} />
                  <ul className={s.menuList}>
                    <li className={s.menuItem}>
                      <Link
                        to='/admin'
                        className={s.menuLink}
                        onClick={handleCloseSidebar}
                      >
                        <span className={s.menuIcon}>⚙️</span>
                        <span className={s.menuLabel}>
                          {t('navigation.admin', 'Admin Panel')}
                        </span>
                      </Link>
                    </li>
                  </ul>
                </>
              )}
              {isAuth && (
                <>
                  <div className={s.divider} />
                  <ul className={s.menuList}>
                    <li className={s.menuItem}>
                      <Link
                        to='/profile'
                        className={s.menuLink}
                        onClick={handleCloseSidebar}
                      >
                        <span className={s.menuIcon}>👤</span>
                        <span className={s.menuLabel}>
                          {t('navigation.profile', 'Profile')}
                        </span>
                      </Link>
                    </li>
                    <li className={s.menuItem}>
                      <button
                        className={clsx(s.menuLink, s.logoutButton)}
                        onClick={handleLogout}
                      >
                        <span className={s.menuIcon}>🚪</span>
                        <span className={s.menuLabel}>
                          {t('navigation.logout')}
                        </span>
                      </button>
                    </li>
                  </ul>
                </>
              )}
            </>
          )}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className={s.overlay}
          onClick={handleCloseSidebar}
          role='presentation'
        />
      )}
    </>
  );
}

export default Sidebar;
