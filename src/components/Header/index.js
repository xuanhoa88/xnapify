/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import Link from '../Link';
import Navigation from '../Navigation';
import s from './Header.css';

function Header({ showHero = false }) {
  const { t } = useTranslation();
  return (
    <>
      {/* Sticky Navigation Bar */}
      <div className={s.navbar}>
        <div className={s.navContainer}>
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
          <Navigation />
          <LanguageSwitcher />
        </div>
      </div>

      {/* Hero Section (only on homepage) */}
      {showHero && (
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

Header.propTypes = {
  showHero: PropTypes.bool,
};

export default Header;
