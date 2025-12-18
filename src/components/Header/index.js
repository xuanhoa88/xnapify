/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar, shouldShowPageHeader } from '../../redux';
import LanguageSwitcher from './LanguageSwitcher';
import { Link } from '../../components/History';
import s from './Header.css';

function Header() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const showPageHeader = useSelector(shouldShowPageHeader);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  return (
    <>
      {/* Sticky Navigation Bar */}
      <div className={s.navbar}>
        <div className={s.navContainer}>
          <button
            className={s.sidebarToggle}
            onClick={handleToggleSidebar}
            aria-label='Toggle sidebar'
          >
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M3 12H21M3 6H21M3 18H21'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
          <Link className={s.brand} to='/'>
            <img
              src='/rsk_38x38.png'
              srcSet='/rsk_72x72.png 2x'
              width='38'
              height='38'
              alt='RSK'
            />
            <span className={s.brandTxt}>{t('header.brand')}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Page Header (only on homepage) */}
      {showPageHeader && (
        <div className={s.hero}>
          <div className={s.heroContent}>
            <h1 className={s.heroTitle}>React Starter Kit</h1>
            <p className={s.heroSubtitle}>
              A professional boilerplate for building modern web applications
              with React, Redux, and server-side rendering
            </p>
            <div className={s.heroActions}>
              <a
                href='https://github.com/xuanhoa88/rapid-rsk'
                className={s.btnPrimary}
                target='_blank'
                rel='noopener noreferrer'
              >
                View on GitHub
              </a>
              <Link to='/about' className={s.btnSecondary}>
                Learn More
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;
