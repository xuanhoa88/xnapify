/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState, useEffect, useMemo } from 'react';
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
import {
  useHistory,
  Link,
} from '../../../../../../shared/renderer/components/History';
import { useWebSocket } from '../../../../../../shared/ws/client';
import Icon from '../../../../../../shared/renderer/components/Icon';
import Button from '../../../../../../shared/renderer/components/Button';
import { checkPermission } from '../../../../../../shared/renderer/components/Rbac';
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

      // Admin bypass
      if (user.is_admin) return true;

      // Use shared RBAC logic for permission matching (supports wildcards)
      return checkPermission(user, permission);
    };

    const formatMenus = (items, user) => {
      // Process the menus to ensure they have the correct structure
      const sections = {};

      items.forEach(item => {
        if (!item || !item.ns) return;

        // Permission check
        if (!hasPermission(user, item.permission)) return;

        const key = item.ns;
        if (!sections[key]) {
          sections[key] = {
            ns: item.ns,
            items: [],
            order: item.order || 99,
            seenPaths: new Set(),
          };
        }

        // Deduplication check
        if (item.path && !sections[key].seenPaths.has(item.path)) {
          sections[key].seenPaths.add(item.path);
          sections[key].items.push(item);
        }
      });

      return Object.values(sections)
        .map(groupBy => {
          // Only return sections that have items
          if (groupBy.items.length === 0) return null;

          const { seenPaths: _, ...cleanSection } = groupBy;
          return cleanSection;
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);
    };

    return [
      {
        ns: t('navigation.main', 'Main'),
        items: [
          {
            path: '/admin',
            label: t('navigation.dashboard', 'Dashboard'),
            icon: 'dashboard',
            exact: true,
          },
        ],
        order: 0,
      },
      {
        ns: t('navigation.system', 'System'),
        items: [
          hasPermission(user, 'nodered:admin') && {
            path: '/~/red/admin',
            label: t('navigation.nodeRed', 'Node-RED'),
            icon: 'node-red',
            external: true,
          },
        ],
        order: 100,
      },
      ...formatMenus(dynamicMenus, user),
    ]
      .reduce((acc, section) => {
        if (!section) return acc;

        // Filter out falsy items (e.g. permission check failures)
        const validItems = section.items.filter(Boolean);
        if (validItems.length === 0) return acc;

        const existingSection = acc.find(sec => sec.ns === section.ns);
        if (existingSection) {
          existingSection.items.push(...validItems);
          // Keep the lower order (higher priority)
          existingSection.order = Math.min(
            existingSection.order,
            section.order,
          );
        } else {
          acc.push({
            ...section,
            items: validItems,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => a.order - b.order);
  }, [t, user, dynamicMenus]);

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
                {(user.display_name && user.display_name.charAt(0)) || 'A'}
              </div>
              <div className={s.userDetails}>
                <span className={s.userName}>
                  {user.display_name || t('common.admin', 'Admin')}
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
