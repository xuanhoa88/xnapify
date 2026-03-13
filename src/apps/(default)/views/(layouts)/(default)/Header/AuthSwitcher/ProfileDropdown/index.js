/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo } from 'react';

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import { Link, useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import { checkPermission } from '@shared/renderer/components/Rbac';
import {
  getUserDisplayName,
  getUserEmail,
  getUserAvatarUrl,
  getUserProfile,
  logout,
} from '@shared/renderer/redux';
import { useWebSocket } from '@shared/ws/client';

import s from './ProfileDropdown.css';

/**
 * ProfileDropdown Component
 * User profile dropdown with navigation and logout for authenticated users
 */
function ProfileDropdown() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();

  // Redux state
  const displayName = useSelector(getUserDisplayName);
  const email = useSelector(getUserEmail);
  const avatarUrl = useSelector(getUserAvatarUrl);
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
      history.replace('/');
    },
    [dispatch, ws, history],
  );

  // Get avatar initial
  const avatarInitial = useMemo(() => {
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  }, [displayName]);

  return (
    <div className={s.profileMenu}>
      <ContextMenu isOpen={isOpen} onToggle={setIsOpen}>
        <ContextMenu.Trigger variant='unstyled' className={s.profileBtn}>
          <div className={s.avatar}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=''
                className={s.avatarImg}
                onError={e => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              avatarInitial
            )}
          </div>
          <span className={s.profileName}>{displayName}</span>
          <Icon
            name='chevronDown'
            size={12}
            className={clsx(s.chevron, { [s.chevronOpen]: isOpen })}
          />
        </ContextMenu.Trigger>

        <ContextMenu.Menu>
          <ContextMenu.Header title={displayName} subtitle={email} />

          <ContextMenu.Item as={Link} to='/profile' onClick={handleClose}>
            <Icon name='user' size={16} />
            {t('navigation.profile', 'Profile')}
          </ContextMenu.Item>

          {checkPermission(userProfile, 'nodered:admin') && (
            <ContextMenu.Item as='a' href='/~/red/admin' onClick={handleClose}>
              <Icon name='node-red' size={16} />
              {t('navigation.nodeRed', 'Node-RED')}
            </ContextMenu.Item>
          )}

          <ContextMenu.Item as={Link} to='/admin' onClick={handleClose}>
            <Icon name='settings' size={16} />
            {t('navigation.admin', 'Admin Panel')}
          </ContextMenu.Item>

          <ContextMenu.Divider />

          <ContextMenu.Item onClick={handleLogout} variant='danger'>
            <Icon name='logout' size={16} />
            {t('navigation.logout', 'Logout')}
          </ContextMenu.Item>
        </ContextMenu.Menu>
      </ContextMenu>
    </div>
  );
}

export default ProfileDropdown;
