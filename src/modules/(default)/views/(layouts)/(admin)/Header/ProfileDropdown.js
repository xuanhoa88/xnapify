/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import clsx from 'clsx';
import {
  Link,
  useHistory,
} from '../../../../../../shared/renderer/components/History';
import {
  getUserDisplayName,
  getUserAvatarUrl,
  getUserRoles,
  getUserProfile,
  logout,
} from '../../../../../../shared/renderer/redux';
import { useWebSocket } from '../../../../../../shared/ws/client';
import Icon from '../../../../../../shared/renderer/components/Icon';
import Button from '../../../../../../shared/renderer/components/Button';
import { checkPermission } from '../../../../../../shared/renderer/components/Rbac';
import s from './ProfileDropdown.css';

/**
 * ProfileDropdown Component
 * User profile dropdown with navigation and logout
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
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handlers
  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

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
    <div className={s.userMenu} ref={dropdownRef}>
      <Button
        variant='unstyled'
        className={s.userMenuBtn}
        onClick={handleToggle}
      >
        <div className={s.userAvatar}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=''
              className={s.userAvatarImg}
              onError={e => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            avatarInitial
          )}
        </div>
        <div className={s.userInfo}>
          <span className={s.userName}>{displayName}</span>
          <span className={s.userRole}>{displayRole}</span>
        </div>
        <Icon
          name='chevronDown'
          size={12}
          className={clsx(s.dropdownIcon, {
            [s.dropdownIconOpen]: isOpen,
          })}
        />
      </Button>

      {isOpen && (
        <div className={s.userDropdown} role='menu'>
          <div className={s.dropdownHeader}>
            <div className={s.dropdownUserName}>{displayName}</div>
            <div className={s.dropdownUserEmail}>{displayRole}</div>
          </div>

          {checkPermission(userProfile, 'nodered:admin') && (
            <a
              className={s.dropdownItem}
              href='/~/red/admin'
              onClick={handleClose}
              role='menuitem'
            >
              <Icon name='extension' size={16} />
              Node-RED
            </a>
          )}

          <Link
            className={s.dropdownItem}
            to='/profile'
            onClick={handleClose}
            role='menuitem'
          >
            <Icon name='user' size={16} />
            {t('navigation.profile', 'Profile')}
          </Link>

          <Link
            className={s.dropdownItem}
            to='/'
            onClick={handleClose}
            role='menuitem'
          >
            <Icon name='arrowUp' size={16} />
            {t('navigation.backToSite', 'Back to Site')}
          </Link>

          <div className={s.dropdownDivider} />

          <Button
            variant='unstyled'
            className={clsx(s.dropdownItem, s.dropdownItemDanger)}
            onClick={handleLogout}
          >
            <Icon name='logout' size={16} />
            {t('navigation.logout', 'Logout')}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ProfileDropdown;
