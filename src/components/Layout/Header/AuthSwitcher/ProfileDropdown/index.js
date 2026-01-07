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
  getUserDisplayName,
  getUserEmail,
  getUserAvatarUrl,
  logout,
} from '../../../../../redux';
import { Link, useHistory } from '../../../../History';
import { useWebSocket } from '../../../../../shared/ws/client';
import Icon from '../../../../Icon';
import Button from '../../../../Button';
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
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  }, [displayName]);

  return (
    <div className={s.profileMenu} ref={dropdownRef}>
      <Button
        variant='unstyled'
        className={s.profileBtn}
        onClick={handleToggle}
      >
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
      </Button>

      {isOpen && (
        <div className={s.dropdown} role='menu'>
          <div className={s.dropdownHeader}>
            <div className={s.dropdownName}>{displayName}</div>
            {email && <div className={s.dropdownEmail}>{email}</div>}
          </div>

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
            to='/admin'
            onClick={handleClose}
            role='menuitem'
          >
            <Icon name='settings' size={16} />
            {t('navigation.admin', 'Admin Panel')}
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
