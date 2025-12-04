/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */
import cx from 'classnames';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import Link from '../Link';
import {
  isAuthenticated,
  isAdmin,
  getCurrentUserDisplayName,
  logout,
} from '../../redux';
import { replaceTo } from '../../navigator';
import s from './Navigation.css';

function Navigation() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isAuth = useSelector(isAuthenticated);
  const isAdminActive = useSelector(isAdmin);
  const displayName = useSelector(getCurrentUserDisplayName);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async e => {
    e.preventDefault();
    setIsDropdownOpen(false);
    await dispatch(logout());
    replaceTo('/');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Get first letter of display name for avatar
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  return (
    <div className={s.root} role='navigation'>
      <Link className={s.link} to='/about'>
        {t('navigation.about')}
      </Link>
      <Link className={s.link} to='/contact'>
        {t('navigation.contact')}
      </Link>
      <span className={s.spacer}> | </span>
      {isAuth ? (
        <div className={s.userMenu} ref={dropdownRef}>
          <button
            className={s.userMenuButton}
            onClick={toggleDropdown}
            aria-expanded={isDropdownOpen}
            aria-haspopup='true'
            aria-label='User menu'
          >
            <div className={s.avatar}>{avatarInitial}</div>
            <span className={s.userName}>{displayName}</span>
            <svg
              className={cx(s.dropdownIcon, {
                [s.dropdownIconOpen]: isDropdownOpen,
              })}
              width='12'
              height='12'
              viewBox='0 0 12 12'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M2.5 4.5L6 8L9.5 4.5'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
          {isDropdownOpen && (
            <div className={s.userMenuDropdown} role='menu'>
              <Link
                className={s.userMenuItem}
                to='/profile'
                onClick={() => setIsDropdownOpen(false)}
                role='menuitem'
              >
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 16 16'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M8 8C9.933 8 11.5 6.433 11.5 4.5C11.5 2.567 9.933 1 8 1C6.067 1 4.5 2.567 4.5 4.5C4.5 6.433 6.067 8 8 8Z'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M13.5 15C13.5 12.515 11.0899 10.5 8 10.5C4.91015 10.5 2.5 12.515 2.5 15'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                {t('navigation.profile')}
              </Link>
              {isAdminActive && (
                <Link
                  className={s.userMenuItem}
                  to='/admin'
                  onClick={() => setIsDropdownOpen(false)}
                  role='menuitem'
                >
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 16 16'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <path
                      d='M8 2V14'
                      stroke='currentColor'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                    <path
                      d='M2 8H14'
                      stroke='currentColor'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                  {t('navigation.admin', 'Admin Panel')}
                </Link>
              )}
              <a
                className={s.userMenuItem}
                href='/logout'
                onClick={handleLogout}
                role='menuitem'
              >
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 16 16'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M6 15H3.5C2.67157 15 2 14.3284 2 13.5V2.5C2 1.67157 2.67157 1 3.5 1H6'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M11 11.5L14.5 8L11 4.5'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M14.5 8H6'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                {t('navigation.logout')}
              </a>
            </div>
          )}
        </div>
      ) : (
        <>
          <Link className={s.link} to='/login'>
            {t('navigation.login')}
          </Link>
          <span className={s.spacer}>{t('navigation.separator.or')}</span>
          <Link className={cx(s.link, s.highlight)} to='/register'>
            {t('navigation.register')}
          </Link>
        </>
      )}
    </div>
  );
}

export default Navigation;
