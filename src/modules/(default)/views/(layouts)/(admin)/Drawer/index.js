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
  isAuthenticated,
  logout,
  getUserProfile,
  toggleDrawer,
  isDrawerOpen,
} from '../../../../../../shared/renderer/redux';
import { useHistory, Link } from '../../../../../../components/History';
import { useWebSocket } from '../../../../../../shared/ws/client';
import Icon from '../../../../../../components/Icon';
import Button from '../../../../../../components/Button';
import s from './Drawer.css';

function Drawer() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();

  const drawerOpen = useSelector(state => isDrawerOpen(state, 'admin'));
  const isAuth = useSelector(isAuthenticated);
  const user = useSelector(getUserProfile);

  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(history.location.pathname);
    const unsubscribe = history.listen(location => {
      setCurrentPath(location.pathname);
    });
    return unsubscribe;
  }, [history]);

  const handleCloseDrawer = useCallback(() => {
    dispatch(toggleDrawer('admin'));
  }, [dispatch]);

  const handleLogout = useCallback(async () => {
    await dispatch(logout());
    handleCloseDrawer();
    if (ws) {
      ws.logout();
    }
  }, [dispatch, handleCloseDrawer, ws]);

  const isActive = useCallback(
    (path, exact = false) => {
      if (!currentPath) return false;
      if (exact) return currentPath === path;
      return currentPath.startsWith(path);
    },
    [currentPath],
  );

  // Navigation menu items with SVG icon names
  const menuItems = [
    {
      section: t('navigation.main', 'Main'),
      items: [
        {
          path: '/admin',
          label: t('navigation.dashboard', 'Dashboard'),
          icon: 'dashboard',
          exact: true,
        },
      ],
    },
    {
      section: t('navigation.management', 'Management'),
      items: [
        {
          path: '/admin/users',
          label: t('navigation.users', 'Users'),
          icon: 'users',
        },
        {
          path: '/admin/groups',
          label: t('navigation.groups', 'Groups'),
          icon: 'folder',
        },
        {
          path: '/admin/roles',
          label: t('navigation.roles', 'Roles'),
          icon: 'shield',
        },
        {
          path: '/admin/permissions',
          label: t('navigation.permissions', 'Permissions'),
          icon: 'key',
        },
      ],
    },
  ];

  return (
    <>
      <aside className={clsx(s.drawer, { [s.open]: drawerOpen })}>
        {/* Header */}
        <div className={s.drawerHeader}>
          <div className={s.brand}>
            <span className={s.brandLogo}>⚡</span>
            <span className={s.brandName}>RSK</span>
          </div>
          <Button
            variant='ghost'
            iconOnly
            onClick={handleCloseDrawer}
            title='Close menu'
          >
            <Icon name='close' size={20} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className={s.nav}>
          {menuItems.map(section => (
            <div key={section.section} className={s.section}>
              <h3 className={s.sectionTitle}>{section.section}</h3>
              <ul className={s.menuList}>
                {section.items.map(item => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={clsx(s.menuLink, {
                        [s.active]: isActive(item.path, item.exact),
                      })}
                      onClick={handleCloseDrawer}
                    >
                      <Icon name={item.icon} size={18} className={s.menuIcon} />
                      <span className={s.menuLabel}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Divider */}
          <div className={s.divider} />

          {/* Quick Links */}
          <div className={s.section}>
            <h3 className={s.sectionTitle}>
              {t('navigation.quick', 'Quick Links')}
            </h3>
            <ul className={s.menuList}>
              <li>
                <Link to='/' className={s.menuLink} onClick={handleCloseDrawer}>
                  <Icon name='arrowUp' size={18} className={s.menuIcon} />
                  <span className={s.menuLabel}>
                    {t('navigation.backToSite', 'Back to Site')}
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        {/* User Footer */}
        {isAuth && user && (
          <div className={s.footer}>
            <div className={s.userInfo}>
              <div className={s.userAvatar}>
                {(user.display_name && user.display_name.charAt(0)) || 'A'}
              </div>
              <div className={s.userDetails}>
                <span className={s.userName}>
                  {user.display_name || 'Admin'}
                </span>
                <span className={s.userRole}>{user.email}</span>
              </div>
            </div>
            <Button
              variant='ghost'
              iconOnly
              onClick={handleLogout}
              title={t('navigation.logout', 'Logout')}
            >
              <Icon name='logout' size={18} />
            </Button>
          </div>
        )}
      </aside>

      {/* Overlay */}
      {drawerOpen && (
        <div
          className={s.overlay}
          onClick={handleCloseDrawer}
          role='presentation'
        />
      )}
    </>
  );
}

export default Drawer;
