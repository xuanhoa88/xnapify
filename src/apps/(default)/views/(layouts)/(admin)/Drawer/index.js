/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Box, Text, Tooltip, HoverCard } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory, Link } from '@shared/renderer/components/History';
import { checkPermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import s from './Drawer.css';

const {
  isAuthenticated,
  logout,
  getUserProfile,
  getUserRoles,
  toggleDrawer,
  isDrawerOpen,
} = features;

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

  const roles = useSelector(getUserRoles);

  const userDisplayRole = useMemo(() => {
    if (!roles || roles.length === 0) return t('common.user', 'User');
    const specializedRole = roles.find(r => {
      const roleName = typeof r === 'string' ? r : r.name;
      return roleName !== 'user';
    });
    const roleToDisplay = specializedRole || roles[0];
    const roleName =
      typeof roleToDisplay === 'string' ? roleToDisplay : roleToDisplay.name;
    return roleName.charAt(0).toUpperCase() + roleName.slice(1);
  }, [roles, t]);

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
    const Icon = resolveIcon(item.icon);
    const treatAsCompact = isCompact && !item.isSubItem;

    const content = (
      <Flex
        align='center'
        gap='3'
        className={clsx(
          'rounded-lg transition-all duration-200 cursor-pointer select-none relative group/item no-underline',
          treatAsCompact
            ? 'w-10 h-10 p-0 justify-center mx-auto flex'
            : 'w-full py-2.5 px-3',
          !active && 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
          active && 'text-white font-medium bg-blue-500/15',
        )}
      >
        {active && (
          <Box
            className={clsx(
              'absolute left-0 w-[3px] rounded-r-full bg-blue-400',
              treatAsCompact
                ? 'top-[15%] bottom-[15%]'
                : 'top-[15%] bottom-[15%]',
            )}
          />
        )}
        <Icon
          width={treatAsCompact ? 20 : 18}
          height={treatAsCompact ? 20 : 18}
          className={clsx(
            'shrink-0 transition-colors',
            active
              ? 'text-blue-400'
              : 'text-slate-500 group-hover/item:text-slate-300',
          )}
        />
        {!treatAsCompact && (
          <Text
            size='2'
            weight={active ? 'medium' : 'regular'}
            className='truncate leading-normal text-[13.5px]'
          >
            {item.label}
          </Text>
        )}
      </Flex>
    );

    const linkProps = {
      onClick: isMobile ? handleCloseMobileDrawer : undefined,
      className:
        'no-underline block mb-0.5 focus-visible:outline-none [color:inherit]',
    };

    if (item.external) {
      return (
        <a href={item.path} {...linkProps}>
          {treatAsCompact ? (
            <Tooltip content={item.label} side='right'>
              {content}
            </Tooltip>
          ) : (
            content
          )}
        </a>
      );
    }

    return (
      <Link to={item.path} {...linkProps}>
        {treatAsCompact ? (
          <Tooltip content={item.label} side='right' delayDuration={80}>
            {content}
          </Tooltip>
        ) : (
          content
        )}
      </Link>
    );
  };

  const resolveIcon = icon => {
    if (typeof icon === 'string') return RadixIcons[icon] || RadixIcons.BoxIcon;
    return icon || RadixIcons.BoxIcon;
  };

  const renderCompactGroup = group => {
    if (!group.items || group.items.length === 0) return null;
    if (group.items.length === 1) return renderLink(group.items[0]);

    const firstItem = group.items[0];
    const groupActive = group.items.some(item =>
      isActive(item.path, item.exact),
    );
    const Icon = resolveIcon(firstItem.icon || group.icon);

    return (
      <HoverCard.Root
        openDelay={100}
        closeDelay={100}
        key={group.id || group.ns}
      >
        <HoverCard.Trigger>
          <Box className='cursor-pointer outline-none w-full'>
            <Flex
              align='center'
              justify='center'
              className={clsx(
                'w-10 h-10 rounded-lg mx-auto transition-all duration-200 relative flex',
                !groupActive &&
                  'text-slate-500 hover:text-white hover:bg-white/[0.06]',
                groupActive && 'text-blue-400 bg-blue-500/15',
              )}
            >
              {groupActive && (
                <Box className='absolute left-0 top-[15%] bottom-[15%] w-[3px] rounded-r-full bg-blue-400' />
              )}
              <Icon width={20} height={20} />
            </Flex>
          </Box>
        </HoverCard.Trigger>
        <HoverCard.Content
          side='right'
          align='start'
          sideOffset={16}
          className='p-2 bg-[#0a1628] border border-white/[0.06] shadow-xl min-w-[220px]'
        >
          <Text
            as='div'
            className='uppercase tracking-[0.08em] text-slate-500 px-2 mb-2 select-none text-[10px] font-semibold'
          >
            {group.ns}
          </Text>
          <Flex direction='column' gap='0.5'>
            {group.items.map(item => (
              <Box key={item.path}>
                {renderLink({ ...item, isSubItem: true })}
              </Box>
            ))}
          </Flex>
        </HoverCard.Content>
      </HoverCard.Root>
    );
  };

  return (
    <>
      <Flex
        as='aside'
        ref={siderRef}
        direction='column'
        className={clsx(
          'bg-[#0a1628] transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] top-0 left-0 bottom-0 z-40',
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
          px={isCompact ? '0' : '5'}
          shrink='0'
          className='border-b border-white/[0.06]'
        >
          <Flex
            align='center'
            justify='center'
            className={clsx(
              'relative group/logo cursor-pointer overflow-hidden shrink-0',
              isCompact ? 'w-10 h-10' : 'w-8 h-8',
            )}
          >
            <Box className='absolute inset-0 bg-white/5 opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300' />
            <img
              alt={t('header.brand', 'xnapify')}
              src='/xnapify_38x38.png'
              srcSet='/xnapify_72x72.png 2x'
              className={clsx(
                'rounded-md transition-transform duration-300 group-hover/logo:scale-110',
                isCompact ? 'w-[24px] h-[24px]' : 'w-[20px] h-[20px]',
              )}
            />
          </Flex>
          {!isCompact && (
            <Flex direction='column' justify='center'>
              <Text
                size='4'
                weight='bold'
                className='text-white tracking-tight leading-none mt-0.5'
              >
                {t('header.brand', 'xnapify')}
              </Text>
              <Text
                size='1'
                className='text-slate-400 font-medium tracking-wide uppercase text-[9px] mt-1'
              >
                {t('header.brandSub', 'Admin Panel')}
              </Text>
            </Flex>
          )}
        </Flex>

        <Box
          as='nav'
          grow='1'
          p={isCompact ? '2' : '3'}
          pt='4'
          className={clsx('overflow-y-auto overflow-x-hidden', s.scrollArea)}
        >
          {menuItems.map((group, gi) => {
            return (
              <Box key={group.id || group.ns} mb='4' className='w-full'>
                {/* Group Header */}
                {!isCompact && (
                  <Text
                    as='div'
                    className='uppercase tracking-[0.08em] text-slate-500 px-3 mb-1.5 select-none text-[10.5px] font-semibold'
                  >
                    {group.ns}
                  </Text>
                )}

                {/* Divider for compact mode */}
                {isCompact && gi > 0 && (
                  <Box className='h-px bg-white/[0.06] mx-2 mb-2.5 mt-[-4px]' />
                )}

                {/* Items */}
                <Flex direction='column' align='center' gap='0.5'>
                  {isCompact
                    ? renderCompactGroup(group)
                    : group.items.map(item => (
                        <Box key={item.path} className='w-full'>
                          {renderLink(item)}
                        </Box>
                      ))}
                </Flex>
              </Box>
            );
          })}

          {/* Quick Links */}
          <Box mb='4' className='w-full'>
            {!isCompact && (
              <Text
                as='div'
                className='uppercase tracking-[0.08em] text-slate-500 px-3 mb-1.5 select-none text-[10.5px] font-semibold mt-6'
              >
                {t('navigation.quick', 'Quick Links')}
              </Text>
            )}
            {isCompact && (
              <Box className='h-px bg-white/[0.06] mx-2 mb-2.5 mt-[-4px]' />
            )}
            <Flex direction='column' align='center' gap='0.5'>
              <Box className={isCompact ? '' : 'w-full'}>
                {renderLink({
                  path: '/',
                  label: t('navigation.backToSite', 'Back to Site'),
                  icon: 'ArrowTopRightIcon',
                  external: true,
                })}
              </Box>
            </Flex>
          </Box>
        </Box>

        {/* User Footer */}
        {isAuth && user && (
          <Box shrink='0' className='border-t border-white/[0.06] w-full'>
            {isCompact ? (
              <Flex
                direction='column'
                align='center'
                py='3'
                className='group/footer w-full'
              >
                <Tooltip content={userDisplayName} side='right'>
                  <Flex
                    align='center'
                    justify='center'
                    className='w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 text-white cursor-default select-none shadow-sm shadow-orange-500/25'
                  >
                    <RadixIcons.PersonIcon width={20} height={20} />
                  </Flex>
                </Tooltip>
                <Tooltip
                  content={t('navigation.logout', 'Logout')}
                  side='right'
                >
                  <Flex
                    align='center'
                    justify='center'
                    role='button'
                    tabIndex={0}
                    onClick={handleLogout}
                    className='w-9 h-9 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer mt-1.5 opacity-0 group-hover/footer:opacity-100'
                  >
                    <RadixIcons.ExitIcon width={16} height={16} />
                  </Flex>
                </Tooltip>
              </Flex>
            ) : (
              <Flex
                align='center'
                justify='between'
                className='px-4 py-3.5 group/footer w-full'
              >
                <Flex align='center' gap='3' className='min-w-0'>
                  <Flex
                    align='center'
                    justify='center'
                    width='38px'
                    height='38px'
                    shrink='0'
                    className='rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-sm shadow-orange-500/25'
                  >
                    <RadixIcons.PersonIcon width={20} height={20} />
                  </Flex>
                  <Flex direction='column' className='min-w-0'>
                    <Text
                      size='2'
                      weight='bold'
                      className='text-white truncate leading-none text-[13.5px]'
                    >
                      {userDisplayName || t('common.admin', 'Admin')}
                    </Text>
                    <Text className='text-slate-500 uppercase tracking-[0.08em] text-[10px] font-semibold mt-1 truncate leading-none'>
                      {userDisplayRole}
                    </Text>
                  </Flex>
                </Flex>
                <Tooltip content={t('navigation.logout', 'Logout')}>
                  <Flex
                    align='center'
                    justify='center'
                    role='button'
                    tabIndex={0}
                    onClick={handleLogout}
                    className='w-8 h-8 rounded-lg shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-0 group-hover/footer:opacity-100'
                  >
                    <RadixIcons.ExitIcon width={15} height={15} />
                  </Flex>
                </Tooltip>
              </Flex>
            )}
          </Box>
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
            className='absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-500 cursor-pointer z-10 shadow-sm transition-all duration-200 hover:text-gray-900 hover:border-gray-300 hover:shadow-md'
          >
            <Box
              className={clsx(
                'transition-transform duration-200 flex',
                isExpanded && 'rotate-180',
              )}
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
