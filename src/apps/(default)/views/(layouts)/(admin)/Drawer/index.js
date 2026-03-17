/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect, useMemo } from 'react';

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Button from '@shared/renderer/components/Button';
import { useHistory, Link } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import { checkPermission } from '@shared/renderer/components/Rbac';
import {
  isAuthenticated,
  logout,
  getUserProfile,
  toggleDrawer,
  isDrawerOpen,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import s from './Drawer.css';

function Drawer() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();

  const drawerOpen = useSelector(state => isDrawerOpen(state, 'admin'));
  const isAuth = useSelector(isAuthenticated);
  const user = useSelector(getUserProfile);

  const [currentPath, setCurrentPath] = useState(
    () => history.location.pathname,
  );

  useEffect(() => {
    // Subscribe to location changes
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
  const dynamicMenus = useSelector(state =>
    state.ui.menus && state.ui.menus.admin ? state.ui.menus.admin : [],
  );

  const menuItems = useMemo(() => {
    const hasPermission = (user, permission) => {
      // If no permission required, allow
      if (!permission) return true;

      // If user is not logged in, deny
      if (!user) return false;

      // Use shared RBAC logic for permission matching (supports wildcards)
      return checkPermission(user, permission);
    };

    // 1. Start with the hardcoded Main section
    const mainKey = t('admin:navigation.main', 'Main');
    const sections = [
      {
        ns: mainKey,
        order: 0,
        items: [
          {
            path: '/admin',
            label: t('admin:navigation.dashboard', 'Dashboard'),
            icon: 'dashboard',
            exact: true,
            order: 0,
          },
        ],
      },
    ];

    // 2. Process dynamic menus (which are now already grouped by section in Redux)
    dynamicMenus.forEach(section => {
      if (!section || !section.items) return;

      // Filter items by permission
      const validItems = section.items.filter(item =>
        hasPermission(user, item.permission),
      );

      // Skip section if no valid items
      if (validItems.length === 0) return;

      sections.push({
        ns: section.label || section.id,
        order: section.order != null ? section.order : 99,
        items: [...validItems].sort((a, b) => {
          const orderDiff =
            (a.order != null ? a.order : 99) - (b.order != null ? b.order : 99);
          if (orderDiff !== 0) return orderDiff;
          return (a.label || '').localeCompare(b.label || '');
        }),
      });
    });

    // 3. Sort sections deterministically
    return sections.sort(
      (a, b) => a.order - b.order || a.ns.localeCompare(b.ns),
    );
  }, [t, user, dynamicMenus]);

  const userDisplayName = useMemo(() => {
    if (!isAuth) return '';
    if (!user) return '';
    return user.profile && user.profile.display_name
      ? user.profile.display_name
      : user.email;
  }, [isAuth, user]);

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
            title={t('common.closeMenu', 'Close menu')}
          >
            <Icon name='close' size={20} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className={s.nav}>
          {menuItems.map(groupBy => (
            <div key={groupBy.ns} className={s.section}>
              <h3 className={s.sectionTitle}>{groupBy.ns}</h3>
              <ul className={s.menuList}>
                {groupBy.items.map(item => (
                  <li key={item.path}>
                    {item.external ? (
                      <a
                        href={item.path}
                        className={clsx(s.menuLink, {
                          [s.active]: isActive(item.path, item.exact),
                        })}
                        onClick={handleCloseDrawer}
                      >
                        <Icon
                          name={item.icon}
                          size={18}
                          className={s.menuIcon}
                        />
                        <span className={s.menuLabel}>{item.label}</span>
                      </a>
                    ) : (
                      <Link
                        to={item.path}
                        className={clsx(s.menuLink, {
                          [s.active]: isActive(item.path, item.exact),
                        })}
                        onClick={handleCloseDrawer}
                      >
                        <Icon
                          name={item.icon}
                          size={18}
                          className={s.menuIcon}
                        />
                        <span className={s.menuLabel}>{item.label}</span>
                      </Link>
                    )}
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
                {userDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className={s.userDetails}>
                <span className={s.userName}>
                  {userDisplayName || t('common.admin', 'Admin')}
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
