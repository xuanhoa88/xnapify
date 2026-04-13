/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
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

export const SIDER_WIDTH = 200;
export const SIDER_COLLAPSED_WIDTH = 80;
export const SIDER_MINIMAL_WIDTH = 48;

function Drawer({ minimal = false }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();

  const drawerOpen = useSelector(state => isDrawerOpen(state, 'admin'));
  const isAuth = useSelector(isAuthenticated);
  const user = useSelector(getUserProfile);

  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const siderRef = useRef(null);

  const [currentPath, setCurrentPath] = useState(
    () => history.location.pathname,
  );

  useEffect(() => {
    const unsubscribe = history.listen(location => {
      setCurrentPath(location.pathname);
    });
    return unsubscribe;
  }, [history]);

  // Detect mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = e => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Publish sider width as CSS custom property for layout coordination
  // Initial value is set inline on .root in _layout.js; this handles dynamic toggling
  useEffect(() => {
    const el = siderRef.current;
    const root = el && el.parentElement;
    if (!root) return;
    let width;
    if (minimal && !collapsed) {
      width = SIDER_MINIMAL_WIDTH;
    } else if (!minimal && collapsed) {
      width = SIDER_COLLAPSED_WIDTH;
    } else {
      width = SIDER_WIDTH;
    }
    root.style.setProperty('--sider-width', `${isMobile ? 0 : width}px`);
  }, [collapsed, isMobile, minimal]);

  const handleCloseMobileDrawer = useCallback(() => {
    if (drawerOpen) {
      dispatch(toggleDrawer('admin'));
    }
  }, [dispatch, drawerOpen]);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const handleLogout = useCallback(async () => {
    const currentPath = history.location.pathname;
    await dispatch(logout());
    handleCloseMobileDrawer();
    if (ws) {
      ws.logout();
    }
    history.replace(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }, [dispatch, handleCloseMobileDrawer, ws, history]);

  const isActive = useCallback(
    (path, exact = false) => {
      if (!currentPath) return false;
      if (exact) return currentPath === path;
      return currentPath.startsWith(path);
    },
    [currentPath],
  );

  const dynamicMenus = useSelector(state =>
    state.ui.menus && state.ui.menus.admin ? state.ui.menus.admin : [],
  );

  const menuItems = useMemo(() => {
    const hasPermission = (u, permission) => {
      if (!permission) return true;
      if (!u) return false;
      return checkPermission(u, permission);
    };

    const mainKey = t('admin:navigation.main', 'Main');
    const sections = [
      {
        id: 'main',
        ns: mainKey,
        order: 0,
        icon: 'dashboard',
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

    dynamicMenus.forEach(section => {
      if (!section || !section.items) return;

      const validItems = section.items.filter(item =>
        hasPermission(user, item.permission),
      );

      if (validItems.length === 0) return;

      sections.push({
        id: section.id,
        ns: section.label || section.id,
        order: section.order != null ? section.order : 99,
        icon: section.icon,
        items: [...validItems].sort((a, b) => {
          const orderDiff =
            (a.order != null ? a.order : 99) - (b.order != null ? b.order : 99);
          if (orderDiff !== 0) return orderDiff;
          return (a.label || '').localeCompare(b.label || '');
        }),
      });
    });

    return sections.sort(
      (a, b) => a.order - b.order || a.ns.localeCompare(b.ns),
    );
  }, [t, user, dynamicMenus]);

  const userDisplayName = useMemo(() => {
    if (!isAuth || !user) return '';
    return user.profile && user.profile.display_name
      ? user.profile.display_name
      : user.email;
  }, [isAuth, user]);

  // On desktop the sider is always visible; on mobile it overlays via redux toggle
  // In minimal mode, collapsed=false means narrow (minimal), collapsed=true means expanded
  // In normal mode, collapsed=false means expanded, collapsed=true means collapsed
  const isExpanded = minimal ? collapsed : !collapsed;
  const siderClass = clsx(s.sider, {
    [s.collapsed]: !minimal && collapsed && !isMobile,
    [s.minimal]: minimal && !collapsed && !isMobile,
    [s.mobileOpen]: isMobile && drawerOpen,
  });

  let siderWidth;
  if (minimal && !collapsed) {
    siderWidth = SIDER_MINIMAL_WIDTH;
  } else if (!minimal && collapsed) {
    siderWidth = SIDER_COLLAPSED_WIDTH;
  } else {
    siderWidth = SIDER_WIDTH;
  }

  const isCompact = !isExpanded && !isMobile;

  const renderLink = item => {
    const linkClass = clsx(s.menuItem, {
      [s.active]: isActive(item.path, item.exact),
    });

    const content = (
      <>
        <Icon name={item.icon} size={18} className={s.menuItemIcon} />
        <span className={s.menuItemLabel}>{item.label}</span>
        {isCompact && <span className={s.tooltip}>{item.label}</span>}
      </>
    );

    const linkProps = {
      className: linkClass,
      onClick: isMobile ? handleCloseMobileDrawer : undefined,
    };

    if (item.external) {
      return (
        <a href={item.path} {...linkProps}>
          {content}
        </a>
      );
    }

    return (
      <Link to={item.path} {...linkProps}>
        {content}
      </Link>
    );
  };

  return (
    <>
      <aside
        ref={siderRef}
        className={siderClass}
        {...(!isMobile && { style: { width: siderWidth } })}
        data-sider
      >
        {/* Logo */}
        <div className={s.logo}>
          <span className={s.logoIcon}>
            <img alt={t('header.brand', 'xnapify')} src='/xnapify.png' />
          </span>
          <span className={s.logoText}>{t('header.brand', 'xnapify')}</span>
        </div>

        {/* Menu */}
        <nav className={s.menu}>
          {menuItems.map(group => {
            const hasActiveChild = group.items.some(item =>
              isActive(item.path, item.exact),
            );

            return (
              <div
                key={group.id || group.ns}
                className={clsx(s.menuGroup, {
                  [s.groupActive]: hasActiveChild,
                })}
              >
                {/* Group trigger for minimal mode / Header for expanded mode */}
                <div className={s.menuGroupHeader}>
                  {group.icon && (
                    <div className={s.menuGroupIconWrapper}>
                      <Icon
                        name={group.icon}
                        size={20}
                        className={s.menuGroupIcon}
                      />
                    </div>
                  )}
                  <div className={s.menuGroupLabel}>{group.ns}</div>
                </div>

                {/* Flyout panel (or inline list in expanded mode) */}
                <div className={s.menuFlyoutContent}>
                  <ul className={s.menuList}>
                    {group.items.map(item => (
                      <li key={item.path}>{renderLink(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}

          {/* Divider */}
          <div className={s.divider} />

          {/* Quick Links */}
          <div className={s.menuGroup}>
            <div className={s.menuGroupLabel}>
              {t('navigation.quick', 'Quick Links')}
            </div>
            <ul className={s.menuList}>
              <li>
                <Link
                  to='/'
                  className={s.menuItem}
                  onClick={isMobile ? handleCloseMobileDrawer : undefined}
                >
                  <Icon name='arrowUp' size={18} className={s.menuItemIcon} />
                  <span className={s.menuItemLabel}>
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
            <div className={s.userAvatar}>
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className={s.userDetails}>
              <span className={s.userName}>
                {userDisplayName || t('common.admin', 'Admin')}
              </span>
              <span className={s.userRole}>{user.email}</span>
            </div>
            <Button
              variant='ghost'
              iconOnly
              onClick={handleLogout}
              title={t('navigation.logout', 'Logout')}
              className={s.logoutBtn}
            >
              <Icon name='logout' size={16} />
            </Button>
          </div>
        )}

        {/* Collapse trigger — desktop only */}
        {!isMobile && (
          <div
            className={s.trigger}
            onClick={handleToggleCollapse}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleCollapse();
              }
            }}
            role='button'
            tabIndex={0}
            title={
              isExpanded
                ? t('common.collapse', 'Collapse')
                : t('common.expand', 'Expand')
            }
          >
            <span
              className={s.triggerIcon}
              style={isExpanded ? { transform: 'rotate(180deg)' } : undefined}
            >
              <Icon name='chevronRight' size={16} />
            </span>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {isMobile && drawerOpen && (
        <div
          className={s.overlay}
          onClick={handleCloseMobileDrawer}
          role='presentation'
        />
      )}
    </>
  );
}

Drawer.propTypes = {
  minimal: PropTypes.bool,
};

export default Drawer;
