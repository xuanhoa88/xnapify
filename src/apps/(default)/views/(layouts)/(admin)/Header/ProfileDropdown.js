/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo } from 'react';

import {
  ChevronDownIcon,
  PersonIcon,
  LightningBoltIcon,
  ArrowUpIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import { Flex, Text, Box } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import { Link, useHistory } from '@shared/renderer/components/History';
import { checkPermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
const {
  getUserDisplayName,
  getUserAvatarUrl,
  getUserRoles,
  getUserProfile,
  logout,
} = features;
import { useWebSocket } from '@shared/ws/client';

import s from './ProfileDropdown.css';

/**
 * ProfileDropdown Component
 * User profile dropdown with navigation and logout, using native Radix primitives
 */
function ProfileDropdown() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();

  // Redux state
  const displayName = useSelector(getUserDisplayName);
  const avatarUrl = useSelector(getUserAvatarUrl);
  const roles = useSelector(getUserRoles);
  const userProfile = useSelector(getUserProfile);

  // Local state
  const [isOpen, setIsOpen] = useState(false);

  // Handlers
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleLogout = useCallback(
    async e => {
      e.preventDefault();
      setIsOpen(false);
      await dispatch(logout());
      if (ws) {
        ws.logout();
      }
      const currentPath = history.location.pathname;
      history.replace(`/login?returnTo=${encodeURIComponent(currentPath)}`);
    },
    [dispatch, ws, history],
  );

  // Get avatar initial
  const avatarInitial = useMemo(() => {
    return displayName ? displayName.charAt(0).toUpperCase() : 'A';
  }, [displayName]);

  // Determine display role
  const displayRole = useMemo(() => {
    if (!roles || roles.length === 0) return t('common.user', 'User');

    // Filter out 'user' role to find more specific roles, unless it's the only one
    const specializedRole = roles.find(r => {
      const roleName = typeof r === 'string' ? r : r.name;
      return roleName !== 'user';
    });

    const roleToDisplay = specializedRole || roles[0];
    const roleName =
      typeof roleToDisplay === 'string' ? roleToDisplay : roleToDisplay.name;

    // Capitalize first letter
    return roleName.charAt(0).toUpperCase() + roleName.slice(1);
  }, [roles, t]);

  return (
    <Box position='relative'>
      <ContextMenu isOpen={isOpen} onToggle={setIsOpen}>
        <ContextMenu.Trigger variant='unstyled'>
          <Flex
            align='center'
            gap='2'
            className={clsx(s.profileTrigger, isOpen && s.profileTriggerOpen)}
          >
            <Flex align='center' justify='center' className={s.avatarCircle}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=''
                  className={s.avatarImage}
                  onError={e => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                avatarInitial
              )}
            </Flex>
            <Flex direction='column' className={s.profileInfo}>
              <Text size='3' weight='medium' className={s.profileName}>
                {displayName}
              </Text>
              <Text size='1' color='gray' className={s.profileRole}>
                {displayRole}
              </Text>
            </Flex>
            <Box
              className={clsx(s.profileChevron, isOpen && s.chevronIconOpen)}
            >
              <ChevronDownIcon width={12} height={12} />
            </Box>
          </Flex>
        </ContextMenu.Trigger>

        <ContextMenu.Menu>
          <ContextMenu.Header title={displayName} subtitle={displayRole} />

          <ContextMenu.Item as={Link} to='/profile' onClick={handleClose}>
            <PersonIcon width={16} height={16} />
            {t('navigation.profile', 'Profile')}
          </ContextMenu.Item>

          {checkPermission(userProfile, 'nodered:admin') && (
            <ContextMenu.Item as='a' href='/~/red/admin' onClick={handleClose}>
              <LightningBoltIcon width={16} height={16} />
              Node-RED
            </ContextMenu.Item>
          )}

          <ContextMenu.Item as={Link} to='/' onClick={handleClose}>
            <ArrowUpIcon width={16} height={16} />
            {t('navigation.backToSite', 'Back to Site')}
          </ContextMenu.Item>

          <ContextMenu.Divider />

          <ContextMenu.Item onClick={handleLogout} variant='danger'>
            <ExitIcon width={16} height={16} />
            {t('navigation.logout', 'Logout')}
          </ContextMenu.Item>
        </ContextMenu.Menu>
      </ContextMenu>
    </Box>
  );
}

export default ProfileDropdown;
