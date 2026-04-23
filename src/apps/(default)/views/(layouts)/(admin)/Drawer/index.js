/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Box, Text, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory, Link } from '@shared/renderer/components/History';
import { checkPermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

const { isAuthenticated, logout, getUserProfile, toggleDrawer, isDrawerOpen } =
  features;

export const SIDER_WIDTH = 240;
export const SIDER_COLLAPSED_WIDTH = 80;
export const SIDER_MINIMAL_WIDTH = 64;



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
        icon: 'DashboardIcon',
        items: [
          {
            path: '/admin',
            label: t('admin:navigation.dashboard', 'Dashboard'),
            icon: 'DashboardIcon',
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

  const isExpanded = minimal ? collapsed : !collapsed;

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
    const active = isActive(item.path, item.exact);

    const content = (
      <Flex
        align='center'
        gap='3'
        className={clsx(
          'w-full rounded-md transition-all duration-200 cursor-pointer no-underline py-2 px-3 justify-start text-gray-11 bg-transparent hover:bg-gray-3 hover:text-gray-12',
          {
            'p-3 justify-center': isCompact,
            'text-gray-12 bg-gray-3 font-medium': active,
          },
        )}
      >
        {(() => {
          const Comp = typeof item.icon === 'string'
            ? RadixIcons[item.icon] || RadixIcons.BoxIcon
            : (item.icon || RadixIcons.BoxIcon);
          return <Comp width={18} height={18} />;
        })()}
        {!isCompact && (
          <Text size='3' weight={active ? 'medium' : 'regular'}>
            {item.label}
          </Text>
        )}
      </Flex>
    );

    const linkProps = {
      onClick: isMobile ? handleCloseMobileDrawer : undefined,
      className: 'no-underline block mb-1',
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
      <Flex
        as='aside'
        ref={siderRef}
        direction='column'
        className={clsx(
          'bg-panel-solid border-r border-gray-a5 transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] top-0 left-0 bottom-0 z-40',
          isMobile ? 'fixed' : 'fixed',
        )}
        // eslint-disable-next-line react/forbid-dom-props
        style={{
          width: isMobile ? '80vw' : `${siderWidth}px`,
          maxWidth: isMobile ? '300px' : 'none',
          zIndex: isMobile ? 100 : 40,
          transform:
            isMobile && !drawerOpen ? 'translateX(-100%)' : 'translateX(0)',
          boxShadow: isMobile ? 'var(--shadow-5)' : 'none',
        }}
        data-sider
      >
        {/* Logo */}
        <Flex
          align='center'
          justify={isCompact ? 'center' : 'flex-start'}
          gap='3'
          height='64px'
          px='4'
          shrink='0'
          className='border-b border-gray-a6'
        >
          <Box width='32px' height='32px' shrink='0'>
            <img
              alt={t('header.brand', 'xnapify')}
              src='/xnapify.png'
              className='w-full h-full'
            />
          </Box>
          {!isCompact && (
            <Text size='4' weight='bold' className='text-gray-12'>
              {t('header.brand', 'xnapify')}
            </Text>
          )}
        </Flex>

        <Box as='nav' grow='1' p='3' className='overflow-y-auto'>
          {menuItems.map(group => {
            return (
              <Box key={group.id || group.ns} mb='4'>
                {/* Group Header */}
                {!isCompact && (
                  <Text
                    weight='semibold'
                    className='uppercase tracking-wider text-[11px] px-2 mb-2 block text-gray-10'
                  >
                    {group.ns}
                  </Text>
                )}
                {isCompact && group.icon && (
                  <Flex justify='center' className='mb-2 text-gray-8'>
                    {(() => {
                      const Comp = typeof group.icon === 'string'
                        ? RadixIcons[group.icon] || RadixIcons.BoxIcon
                        : (group.icon || RadixIcons.BoxIcon);
                      return <Comp width={16} height={16} />;
                    })()}
                  </Flex>
                )}

                {/* Items */}
                <Box as='ul' className='list-none p-0 m-0'>
                  {group.items.map(item => (
                    <Box as='li' key={item.path}>
                      {renderLink(item)}
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}

          <Box width='100%' height='1px' my='4' className='bg-gray-a6' />

          {/* Quick Links */}
          <Box mb='4'>
            {!isCompact && (
              <Text
                weight='semibold'
                className='uppercase tracking-wider text-[11px] px-2 mb-2 block text-gray-10'
              >
                {t('navigation.quick', 'Quick Links')}
              </Text>
            )}
            <Box as='ul' className='list-none p-0 m-0'>
              <Box as='li'>
                <Link
                  to='/'
                  onClick={isMobile ? handleCloseMobileDrawer : undefined}
                  className='no-underline block'
                >
                  <Flex
                    align='center'
                    gap='3'
                    className={clsx(
                      'py-2 px-3 justify-start text-gray-11 rounded-md transition-all duration-200 bg-transparent hover:bg-gray-3 hover:text-gray-12',
                      { 'p-3 justify-center': isCompact },
                    )}
                  >
                    <RadixIcons.ArrowUpIcon width={18} height={18} />
                    {!isCompact && (
                      <Text size='3'>
                        {t('navigation.backToSite', 'Back to Site')}
                      </Text>
                    )}
                  </Flex>
                </Link>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* User Footer */}
        {isAuth && user && (
          <Flex
            align='center'
            justify={isCompact ? 'center' : 'space-between'}
            p='4'
            shrink='0'
            className='border-t border-gray-a5 transition-colors hover:bg-gray-2 cursor-pointer'
          >
            <Flex align='center' gap='3'>
              <Flex
                align='center'
                justify='center'
                width='32px'
                height='32px'
                shrink='0'
                className='rounded-full bg-indigo-3 text-indigo-11 font-bold'
              >
                {userDisplayName.charAt(0).toUpperCase()}
              </Flex>
              {!isCompact && (
                <Flex direction='column' overflow='hidden'>
                  <Text size='3' weight='medium' truncate>
                    {userDisplayName || t('common.admin', 'Admin')}
                  </Text>
                  <Text size='1' color='gray' truncate>
                    {user.email}
                  </Text>
                </Flex>
              )}
            </Flex>
            {!isCompact && (
              <Button
                variant='ghost'
                color='gray'
                shrink='0'
                p='2'
                onClick={handleLogout}
                title={t('navigation.logout', 'Logout')}
              >
                <RadixIcons.ExitIcon width={16} height={16} />
              </Button>
            )}
          </Flex>
        )}

        {/* Collapse trigger — desktop only */}
        {!isMobile && (
          <Flex
            align='center'
            justify='center'
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
            className='absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-panel-solid border border-gray-a6 text-gray-9 cursor-pointer z-10 shadow-sm transition-all duration-200 hover:text-gray-12 hover:border-gray-8'
          >
            <Box
              className={clsx('transition-transform duration-200 flex', {
                'rotate-180': isExpanded,
              })}
            >
              <RadixIcons.ChevronRightIcon width={14} height={14} />
            </Box>
          </Flex>
        )}
      </Flex>

      {/* Mobile overlay */}
      {isMobile && drawerOpen && (
        <Box
          className='fixed inset-0 bg-current opacity-50 z-[90]'
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
